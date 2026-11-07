package com.qisma.service.impl;

import com.qisma.dto.response.PageResponse;
import com.qisma.dto.response.SettlementResponse;
import com.qisma.dto.response.SuggestionsResponse;
import com.qisma.dto.response.TransferSuggestionResponse;
import com.qisma.enums.SettlementStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.model.Membership;
import com.qisma.model.Settlement;
import com.qisma.model.User;
import com.qisma.repository.SettlementQueryStore;
import com.qisma.repository.UserRepository;
import com.qisma.security.GroupAccessGuard;
import com.qisma.service.GroupLedger;
import com.qisma.service.LedgerService;
import com.qisma.service.SettlementQueryService;
import com.qisma.service.finance.SettlementOptimizer;
import com.qisma.service.finance.TransferSuggestion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class SettlementQueryServiceImpl implements SettlementQueryService {

    static final int MAX_PAGE_SIZE = 100;
    static final String UNKNOWN_USER = "Unknown user";
    /** Newest first; the id makes the order fully deterministic between pages. */
    static final Sort DEFAULT_SORT = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("_id"));

    private final GroupAccessGuard guard;
    private final SettlementQueryStore store;
    private final LedgerService ledgerService;
    private final UserRepository users;
    private final SettlementOptimizer optimizer;

    public SettlementQueryServiceImpl(GroupAccessGuard guard, SettlementQueryStore store,
                                      LedgerService ledgerService, UserRepository users,
                                      SettlementOptimizer optimizer) {
        this.guard = guard;
        this.store = store;
        this.ledgerService = ledgerService;
        this.users = users;
        this.optimizer = optimizer;
    }

    @Override
    public PageResponse<SettlementResponse> list(String userId, String groupId, SettlementStatus status,
                                                 String memberId, int page, int size) {
        guard.forRead(groupId, userId);
        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED,
                    "Invalid pagination: page must be >= 0 and size between 1 and " + MAX_PAGE_SIZE);
        }
        String member = (memberId == null || memberId.isBlank()) ? null : memberId.trim();

        Page<Settlement> result = store.search(groupId, status, member, PageRequest.of(page, size, DEFAULT_SORT));

        Set<String> ids = new HashSet<>();
        result.getContent().forEach(s -> {
            ids.add(s.getFromUserId());
            ids.add(s.getToUserId());
        });
        Map<String, User> usersById = loadUsers(ids);

        List<SettlementResponse> items = result.getContent().stream()
                .map(s -> toResponse(s, usersById))
                .toList();
        return new PageResponse<>(items, result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    @Override
    public SuggestionsResponse suggestions(String userId, String groupId) {
        GroupAccessGuard.Access access = guard.forRead(groupId, userId);
        GroupLedger ledger = ledgerService.load(groupId);

        // effective nets already count what is still pending, so nothing is suggested twice.
        // Members who left but still owe or are owed take part, so they can settle up.
        Map<String, Long> effectiveNets = new LinkedHashMap<>();
        for (Membership m : ledger.members()) {
            effectiveNets.put(m.getUserId(), ledger.effectiveNetOf(m.getUserId()));
        }
        List<TransferSuggestion> transfers = optimizer.suggest(effectiveNets);

        Set<String> ids = new HashSet<>();
        transfers.forEach(t -> {
            ids.add(t.fromUserId());
            ids.add(t.toUserId());
        });
        Map<String, User> usersById = loadUsers(ids);

        return new SuggestionsResponse(access.group().getCurrency(), transfers.stream()
                .map(t -> new TransferSuggestionResponse(
                        t.fromUserId(), nameOf(usersById, t.fromUserId()),
                        t.toUserId(), nameOf(usersById, t.toUserId()),
                        t.amountMinor()))
                .toList());
    }

    private Map<String, User> loadUsers(Set<String> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return users.findAllById(ids).stream().collect(Collectors.toMap(User::getId, Function.identity()));
    }

    private static String nameOf(Map<String, User> usersById, String id) {
        User user = usersById.get(id);
        return user != null ? user.getUsername() : UNKNOWN_USER;
    }

    private static SettlementResponse toResponse(Settlement s, Map<String, User> usersById) {
        return new SettlementResponse(
                s.getId(), s.getGroupId(),
                s.getFromUserId(), nameOf(usersById, s.getFromUserId()),
                s.getToUserId(), nameOf(usersById, s.getToUserId()),
                s.getAmountMinor(), s.getCurrency(), s.getNote(), s.getStatus(),
                s.getCreatedAt(), s.getConfirmedAt(), s.getRejectedAt(), s.getRejectionReason(),
                s.getCancelledAt(), s.getVersion());
    }
}
