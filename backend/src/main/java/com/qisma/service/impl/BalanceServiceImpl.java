package com.qisma.service.impl;

import com.qisma.dto.response.BalancesResponse;
import com.qisma.dto.response.MemberBalanceResponse;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.model.Membership;
import com.qisma.model.User;
import com.qisma.repository.UserRepository;
import com.qisma.security.GroupAccessGuard;
import com.qisma.service.BalanceService;
import com.qisma.service.GroupLedger;
import com.qisma.service.LedgerService;
import com.qisma.service.finance.MemberBalance;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class BalanceServiceImpl implements BalanceService {

    static final String UNKNOWN_USER = "Unknown user";

    private final LedgerService ledgerService;
    private final UserRepository users;
    private final GroupAccessGuard guard;

    public BalanceServiceImpl(LedgerService ledgerService, UserRepository users, GroupAccessGuard guard) {
        this.ledgerService = ledgerService;
        this.users = users;
        this.guard = guard;
    }

    @Override
    public BalancesResponse getBalances(String userId, String groupId) {
        GroupAccessGuard.Access access = guard.forRead(groupId, userId);
        return toResponse(access.group().getCurrency(), ledgerService.load(groupId));
    }

    @Override
    public MemberBalanceResponse getBalance(String userId, String groupId, String targetUserId) {
        GroupAccessGuard.Access access = guard.forRead(groupId, userId);
        return toResponse(access.group().getCurrency(), ledgerService.load(groupId)).members().stream()
                .filter(m -> m.userId().equals(targetUserId))
                .findFirst()
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Member not found"));
    }

    private BalancesResponse toResponse(String currency, GroupLedger ledger) {
        Map<String, User> usersById = users.findAllById(ledger.members().stream().map(Membership::getUserId).toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));

        long sum = 0L;
        List<MemberBalanceResponse> response = new ArrayList<>();
        for (Membership m : ledger.members()) {
            MemberBalance b = ledger.balances().get(m.getUserId());
            User user = usersById.get(m.getUserId());
            sum = Math.addExact(sum, b.netMinor());
            response.add(new MemberBalanceResponse(
                    m.getUserId(),
                    user != null ? user.getUsername() : UNKNOWN_USER,
                    user != null ? user.getFullName() : UNKNOWN_USER,
                    m.getStatus(),
                    b.paidMinor(), b.shareMinor(), b.sentMinor(), b.receivedMinor(), b.netMinor(),
                    ledger.pendingOutOf(m.getUserId()), ledger.pendingInOf(m.getUserId()),
                    ledger.effectiveNetOf(m.getUserId())));
        }
        return new BalancesResponse(currency, sum, List.copyOf(response));
    }
}
