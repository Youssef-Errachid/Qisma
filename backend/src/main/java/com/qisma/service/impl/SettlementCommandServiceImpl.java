package com.qisma.service.impl;

import com.qisma.dto.request.CreateSettlementRequest;
import com.qisma.dto.response.SettlementResponse;
import com.qisma.enums.ActivityAction;
import com.qisma.enums.SettlementStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.mapper.SettlementMapper;
import com.qisma.model.Settlement;
import com.qisma.repository.GroupLedgerStore;
import com.qisma.repository.MembershipRepository;
import com.qisma.repository.SettlementRepository;
import com.qisma.repository.SettlementTransitionStore;
import com.qisma.security.GroupAccessGuard;
import com.qisma.service.ActivityLogService;
import com.qisma.service.GroupLedger;
import com.qisma.service.LedgerService;
import com.qisma.service.SettlementCommandService;
import com.qisma.service.SettlementResult;
import com.qisma.service.finance.Money;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Settlements move real money between members, so every command here follows the same discipline:
 * 1. the caller is always the authenticated user, never a value from the request;
 * 2. one transaction per command, which starts by advancing the group's ledgerVersion so that two financial
 *    operations of the same group can never both act on the same stale balances;
 * 3. a state change is ONE conditional update, so it cannot be applied twice;
 * 4. the history line is written in the same transaction.
 */
@Service
public class SettlementCommandServiceImpl implements SettlementCommandService {

    static final Pattern IDEMPOTENCY_KEY = Pattern.compile("^[A-Za-z0-9_-]{8,64}$");

    private final SettlementRepository settlements;
    private final MembershipRepository memberships;
    private final SettlementTransitionStore transitions;
    private final GroupAccessGuard guard;
    private final LedgerService ledgerService;
    private final GroupLedgerStore ledger;
    private final ActivityLogService activity;
    private final SettlementMapper mapper;
    private final Clock clock;
    private final TransactionTemplate tx;

    public SettlementCommandServiceImpl(SettlementRepository settlements, MembershipRepository memberships,
                                        SettlementTransitionStore transitions, GroupAccessGuard guard,
                                        LedgerService ledgerService, GroupLedgerStore ledger,
                                        ActivityLogService activity, SettlementMapper mapper, Clock clock,
                                        PlatformTransactionManager transactionManager) {
        this.settlements = settlements;
        this.memberships = memberships;
        this.transitions = transitions;
        this.guard = guard;
        this.ledgerService = ledgerService;
        this.ledger = ledger;
        this.activity = activity;
        this.mapper = mapper;
        this.clock = clock;
        this.tx = new TransactionTemplate(transactionManager);
    }

    // ============================== create ==============================

    @Override
    public SettlementResult create(String userId, String groupId, String idempotencyKey,
                                   CreateSettlementRequest request) {
        GroupAccessGuard.Access access = guard.forWrite(groupId, userId);

        String toUserId = request.toUserId().trim();
        if (toUserId.equals(userId)) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "You cannot settle with yourself");
        }
        String key = normalizeKey(idempotencyKey);
        long amount = request.amountMinor();

        if (key != null) {
            Optional<Settlement> existing = settlements.findByFromUserIdAndIdempotencyKey(userId, key);
            if (existing.isPresent()) {
                return replay(existing.get(), groupId, toUserId, amount);
            }
        }

        // the recipient may be inactive (settle-only), but must belong to this group
        if (memberships.findByGroupIdAndUserId(groupId, toUserId).isEmpty()) {
            throw new ApiException(ErrorCode.PARTICIPANT_NOT_MEMBER, "The recipient is not a member of this group");
        }

        String currency = access.group().getCurrency();
        try {
            Settlement saved = tx.execute(status ->
                    createInTransaction(userId, groupId, toUserId, amount, request.note(), key, currency));
            return new SettlementResult(mapper.toResponse(saved), true);
        } catch (DuplicateKeyException e) {
            // two requests with the same Idempotency-Key raced: the unique index let only one through
            if (key == null) {
                throw e;
            }
            return settlements.findByFromUserIdAndIdempotencyKey(userId, key)
                    .map(s -> replay(s, groupId, toUserId, amount))
                    .orElseThrow(() -> e);
        }
    }

    private Settlement createInTransaction(String userId, String groupId, String toUserId, long amount,
                                           String note, String key, String currency) {
        // first: take the group's write lock. Anything that changes the group's money after this point makes
        // this transaction fail instead of letting two settlements both rely on the same balance.
        ledger.advance(groupId);

        GroupLedger state = ledgerService.load(groupId);
        long owed = Math.max(0L, Math.negateExact(state.effectiveNetOf(userId)));
        long due = Math.max(0L, state.effectiveNetOf(toUserId));

        if (amount > owed) {
            throw new ApiException(ErrorCode.SETTLEMENT_EXCEEDS_BALANCE,
                    "Amount exceeds what you still owe: " + Money.of(owed, currency));
        }
        if (amount > due) {
            throw new ApiException(ErrorCode.SETTLEMENT_EXCEEDS_BALANCE,
                    "Amount exceeds what the recipient is still owed: " + Money.of(due, currency));
        }

        Settlement settlement = new Settlement();
        settlement.setGroupId(groupId);
        settlement.setFromUserId(userId);
        settlement.setToUserId(toUserId);
        settlement.setAmountMinor(amount);
        settlement.setCurrency(currency);
        settlement.setNote(blankToNull(note));
        settlement.setStatus(SettlementStatus.PENDING);
        settlement.setIdempotencyKey(key);
        settlement.setCreatedAt(clock.instant());

        Settlement saved = settlements.save(settlement);
        activity.record(groupId, userId, ActivityAction.SETTLEMENT_CREATED, saved.getId(),
                null, SettlementSnapshots.of(saved));
        return saved;
    }

    private SettlementResult replay(Settlement existing, String groupId, String toUserId, long amount) {
        boolean same = existing.getGroupId().equals(groupId)
                && existing.getToUserId().equals(toUserId)
                && existing.getAmountMinor() == amount;
        if (!same) {
            throw new ApiException(ErrorCode.IDEMPOTENCY_KEY_REUSED,
                    "This Idempotency-Key was already used for a different request");
        }
        return new SettlementResult(mapper.toResponse(existing), false);
    }

    // ============================== confirm / reject / cancel ==============================

    @Override
    public SettlementResponse confirm(String userId, String groupId, String settlementId) {
        guard.forWrite(groupId, userId);
        Settlement current = load(groupId, settlementId);
        requireReceiver(current, userId, "confirm");
        requirePending(current);

        Map<String, Object> before = SettlementSnapshots.of(current);
        Settlement updated = tx.execute(status -> {
            ledger.advance(groupId);
            Settlement done = transitions.markConfirmed(settlementId, groupId, userId, clock.instant())
                    .orElseThrow(SettlementCommandServiceImpl::notPending);
            activity.record(groupId, userId, ActivityAction.SETTLEMENT_CONFIRMED, done.getId(),
                    before, SettlementSnapshots.of(done));
            return done;
        });
        return mapper.toResponse(updated);
    }

    @Override
    public SettlementResponse reject(String userId, String groupId, String settlementId, String reason) {
        guard.forWrite(groupId, userId);
        Settlement current = load(groupId, settlementId);
        requireReceiver(current, userId, "reject");
        requirePending(current);

        String cleanReason = blankToNull(reason);
        Map<String, Object> before = SettlementSnapshots.of(current);
        Settlement updated = tx.execute(status -> {
            ledger.advance(groupId);
            Settlement done = transitions.markRejected(settlementId, groupId, userId, cleanReason, clock.instant())
                    .orElseThrow(SettlementCommandServiceImpl::notPending);
            activity.record(groupId, userId, ActivityAction.SETTLEMENT_REJECTED, done.getId(),
                    before, SettlementSnapshots.of(done));
            return done;
        });
        return mapper.toResponse(updated);
    }

    @Override
    public SettlementResponse cancel(String userId, String groupId, String settlementId) {
        guard.forWrite(groupId, userId);
        Settlement current = load(groupId, settlementId);
        if (!userId.equals(current.getFromUserId())) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Only the sender can cancel a settlement");
        }
        requirePending(current);

        Map<String, Object> before = SettlementSnapshots.of(current);
        Settlement updated = tx.execute(status -> {
            ledger.advance(groupId);
            Settlement done = transitions.markCancelled(settlementId, groupId, userId, clock.instant())
                    .orElseThrow(SettlementCommandServiceImpl::notPending);
            activity.record(groupId, userId, ActivityAction.SETTLEMENT_CANCELLED, done.getId(),
                    before, SettlementSnapshots.of(done));
            return done;
        });
        return mapper.toResponse(updated);
    }

    // ============================== helpers ==============================

    private Settlement load(String groupId, String settlementId) {
        return settlements.findByIdAndGroupId(settlementId, groupId)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Settlement not found"));
    }

    /** Nobody can act in place of the receiver, not even the group owner. */
    private static void requireReceiver(Settlement settlement, String userId, String verb) {
        if (!userId.equals(settlement.getToUserId())) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Only the recipient can " + verb + " a settlement");
        }
    }

    private static void requirePending(Settlement settlement) {
        if (settlement.getStatus() != SettlementStatus.PENDING) {
            throw notPending();
        }
    }

    private static ApiException notPending() {
        return new ApiException(ErrorCode.SETTLEMENT_NOT_PENDING, "This settlement is no longer pending");
    }

    private static String normalizeKey(String key) {
        if (key == null || key.isBlank()) {
            return null;
        }
        String trimmed = key.trim();
        if (!IDEMPOTENCY_KEY.matcher(trimmed).matches()) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED,
                    "Idempotency-Key must be 8 to 64 characters: letters, digits, '-' or '_'");
        }
        return trimmed;
    }

    private static String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }
}
