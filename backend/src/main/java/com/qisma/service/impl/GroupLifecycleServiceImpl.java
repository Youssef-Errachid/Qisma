package com.qisma.service.impl;

import com.qisma.dto.request.TransferOwnershipRequest;
import com.qisma.dto.request.UpdateGroupRequest;
import com.qisma.dto.response.GroupResponse;
import com.qisma.enums.ActivityAction;
import com.qisma.enums.GroupRole;
import com.qisma.enums.MembershipStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.mapper.GroupMapper;
import com.qisma.model.Group;
import com.qisma.model.Membership;
import com.qisma.repository.GroupLedgerStore;
import com.qisma.repository.GroupUpdateStore;
import com.qisma.repository.MembershipRepository;
import com.qisma.security.GroupAccessGuard;
import com.qisma.service.ActivityLogService;
import com.qisma.service.GroupLedger;
import com.qisma.service.GroupLifecycleService;
import com.qisma.service.LedgerService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.util.Currency;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Everything that changes who belongs to a group or what state it is in. Every command that touches the
 * membership starts by advancing the ledgerVersion inside its transaction, so it can never run at the same time
 * as a settlement or an expense of the same group and act on a stale balance.
 */
@Service
public class GroupLifecycleServiceImpl implements GroupLifecycleService {

    private final GroupUpdateStore groups;
    private final MembershipRepository memberships;
    private final GroupAccessGuard guard;
    private final LedgerService ledgerService;
    private final GroupLedgerStore ledger;
    private final ActivityLogService activity;
    private final GroupMapper mapper;
    private final Clock clock;
    private final TransactionTemplate tx;

    public GroupLifecycleServiceImpl(GroupUpdateStore groups, MembershipRepository memberships,
                                     GroupAccessGuard guard, LedgerService ledgerService, GroupLedgerStore ledger,
                                     ActivityLogService activity, GroupMapper mapper, Clock clock,
                                     PlatformTransactionManager transactionManager) {
        this.groups = groups;
        this.memberships = memberships;
        this.guard = guard;
        this.ledgerService = ledgerService;
        this.ledger = ledger;
        this.activity = activity;
        this.mapper = mapper;
        this.clock = clock;
        this.tx = new TransactionTemplate(transactionManager);
    }

    // ============================== update ==============================

    @Override
    public GroupResponse update(String userId, String groupId, UpdateGroupRequest request) {
        Group group = guard.forOwner(groupId, userId).group();

        String name = request.name().trim();
        String description = blankToNull(request.description());
        String newCurrency = changedCurrency(request.currency(), group.getCurrency());

        Map<String, Object> before = details(group.getName(), group.getDescription(), group.getCurrency());
        Map<String, Object> after = details(name, description, newCurrency != null ? newCurrency : group.getCurrency());

        tx.executeWithoutResult(status -> {
            // a conditional update, checked first: once the group has had any expense or settlement the currency
            // is locked, because changing it would silently reinterpret every amount already recorded
            if (newCurrency != null && !groups.changeCurrency(groupId, newCurrency)) {
                throw new ApiException(ErrorCode.CURRENCY_LOCKED,
                        "The currency cannot change once the group has expenses or settlements");
            }
            groups.updateDetails(groupId, name, description);
            activity.record(groupId, userId, ActivityAction.GROUP_UPDATED, groupId, before, after);
        });

        group.setName(name);
        group.setDescription(description);
        if (newCurrency != null) {
            group.setCurrency(newCurrency);
        }
        return mapper.toResponse(group, GroupRole.OWNER);
    }

    // ============================== archive ==============================

    @Override
    public void archive(String userId, String groupId) {
        guard.forOwner(groupId, userId);

        tx.executeWithoutResult(status -> {
            ledger.advance(groupId);
            GroupLedger state = ledgerService.load(groupId);
            if (state.pendingOut().values().stream().anyMatch(amount -> amount > 0L)) {
                throw pendingSettlements("A group cannot be archived while a settlement is still pending");
            }
            if (!groups.archive(groupId, clock.instant())) {
                throw new ApiException(ErrorCode.GROUP_ARCHIVED, "This group is already archived");
            }
            activity.record(groupId, userId, ActivityAction.GROUP_ARCHIVED, groupId,
                    Map.of("status", "ACTIVE"), Map.of("status", "ARCHIVED"));
        });
    }

    // ============================== leave ==============================

    @Override
    public void leave(String userId, String groupId) {
        GroupAccessGuard.Access access = guard.forWrite(groupId, userId);
        if (access.membership().getRole() == GroupRole.OWNER) {
            throw new ApiException(ErrorCode.OWNER_MUST_TRANSFER,
                    "The owner cannot leave: transfer the ownership first");
        }

        tx.executeWithoutResult(status -> {
            ledger.advance(groupId);
            Membership membership = activeMembership(groupId, userId);
            GroupLedger state = ledgerService.load(groupId);

            if (state.pendingOutOf(userId) > 0L || state.pendingInOf(userId) > 0L) {
                throw pendingSettlements("You cannot leave while one of your settlements is still pending");
            }
            long net = state.balances().get(userId).netMinor();
            if (net != 0L) {
                throw new ApiException(ErrorCode.BALANCE_NOT_SETTLED,
                        "You can only leave once your balance is zero (it is " + net + " in minor units)");
            }

            deactivate(membership);
            activity.record(groupId, userId, ActivityAction.MEMBER_LEFT, userId,
                    Map.of("status", "ACTIVE"), Map.of("status", "INACTIVE", "balanceMinor", net));
        });
    }

    // ============================== deactivate a member ==============================

    @Override
    public void deactivateMember(String userId, String groupId, String targetUserId) {
        guard.forOwner(groupId, userId);
        if (targetUserId.equals(userId)) {
            throw new ApiException(ErrorCode.CANNOT_REMOVE_OWNER,
                    "The owner cannot be removed: transfer the ownership first");
        }

        tx.executeWithoutResult(status -> {
            ledger.advance(groupId);
            Membership target = memberships.findByGroupIdAndUserId(groupId, targetUserId)
                    .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Member not found"));
            if (target.getRole() == GroupRole.OWNER) {
                throw new ApiException(ErrorCode.CANNOT_REMOVE_OWNER, "The owner cannot be removed");
            }
            if (target.getStatus() != MembershipStatus.ACTIVE) {
                throw new ApiException(ErrorCode.MEMBER_NOT_ACTIVE, "This member is already inactive");
            }

            GroupLedger state = ledgerService.load(groupId);
            if (state.pendingOutOf(targetUserId) > 0L || state.pendingInOf(targetUserId) > 0L) {
                throw pendingSettlements("This member has a pending settlement: resolve it first");
            }

            // a remaining debt is allowed: the member stays able to settle it, but takes part in nothing new
            deactivate(target);
            activity.record(groupId, userId, ActivityAction.MEMBER_DEACTIVATED, targetUserId,
                    Map.of("status", "ACTIVE"),
                    Map.of("status", "INACTIVE", "balanceMinor", state.balances().get(targetUserId).netMinor()));
        });
    }

    // ============================== transfer ownership ==============================

    @Override
    public GroupResponse transferOwnership(String userId, String groupId, TransferOwnershipRequest request) {
        Group group = guard.forOwner(groupId, userId).group();
        String newOwnerId = request.newOwnerId().trim();
        if (newOwnerId.equals(userId)) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "You already own this group");
        }

        try {
            tx.executeWithoutResult(status -> {
                ledger.advance(groupId);
                Membership current = memberships.findByGroupIdAndUserId(groupId, userId)
                        .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Group not found"));
                Membership target = memberships.findByGroupIdAndUserId(groupId, newOwnerId)
                        .filter(m -> m.getStatus() == MembershipStatus.ACTIVE)
                        .orElseThrow(() -> new ApiException(ErrorCode.PARTICIPANT_NOT_MEMBER,
                                "The new owner must be an active member of this group"));

                // demote first: the database allows only one ACTIVE owner per group
                current.setRole(GroupRole.MEMBER);
                memberships.save(current);
                target.setRole(GroupRole.OWNER);
                memberships.save(target);
                groups.setOwner(groupId, newOwnerId);

                activity.record(groupId, userId, ActivityAction.OWNERSHIP_TRANSFERRED, groupId,
                        Map.of("ownerId", userId), Map.of("ownerId", newOwnerId));
            });
        } catch (DuplicateKeyException e) {
            // two transfers raced: the unique index let only one owner through
            throw new ApiException(ErrorCode.CONCURRENT_UPDATE,
                    "The ownership changed at the same moment. Nothing was saved, please check and try again");
        }

        group.setOwnerId(newOwnerId);
        return mapper.toResponse(group, GroupRole.MEMBER);
    }

    // ============================== helpers ==============================

    private Membership activeMembership(String groupId, String userId) {
        return memberships.findByGroupIdAndUserId(groupId, userId)
                .filter(m -> m.getStatus() == MembershipStatus.ACTIVE)
                .orElseThrow(() -> new ApiException(ErrorCode.MEMBER_NOT_ACTIVE, "You are no longer a member"));
    }

    private void deactivate(Membership membership) {
        membership.setStatus(MembershipStatus.INACTIVE);
        membership.setLeftAt(clock.instant());
        memberships.save(membership);
    }

    private static ApiException pendingSettlements(String message) {
        return new ApiException(ErrorCode.PENDING_SETTLEMENTS, message);
    }

    /** Returns the new currency code, or null when none was asked for or it is the current one. */
    private static String changedCurrency(String requested, String current) {
        if (requested == null || requested.isBlank()) {
            return null;
        }
        String code = requested.trim().toUpperCase(Locale.ROOT);
        try {
            Currency currency = Currency.getInstance(code);
            if (currency.getDefaultFractionDigits() < 0) {
                throw new IllegalArgumentException("not a monetary currency");
            }
            code = currency.getCurrencyCode();
        } catch (IllegalArgumentException e) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Unsupported currency: " + code);
        }
        return code.equals(current) ? null : code;
    }

    private static Map<String, Object> details(String name, String description, String currency) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("name", name);
        snapshot.put("description", description);
        snapshot.put("currency", currency);
        return snapshot;
    }

    private static String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }
}
