package com.qisma.service.impl;

import com.qisma.dto.response.BalancesResponse;
import com.qisma.dto.response.MemberBalanceResponse;
import com.qisma.enums.ExpenseStatus;
import com.qisma.enums.GroupRole;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.model.Membership;
import com.qisma.model.User;
import com.qisma.repository.ExpenseRepository;
import com.qisma.repository.MembershipRepository;
import com.qisma.repository.UserRepository;
import com.qisma.security.GroupAccessGuard;
import com.qisma.service.BalanceService;
import com.qisma.service.finance.BalanceCalculator;
import com.qisma.service.finance.LedgerExpense;
import com.qisma.service.finance.MemberBalance;
import com.qisma.service.finance.ShareAllocation;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Balances are never stored: they are computed on every request from the ACTIVE expenses. Every member of the
 * group takes part (active or not), so nobody who left loses a balance. The calculator itself checks that
 * the balances add up to exactly zero and refuses to answer otherwise.
 */
@Service
public class BalanceServiceImpl implements BalanceService {

    static final String UNKNOWN_USER = "Unknown user";

    private final ExpenseRepository expenses;
    private final MembershipRepository memberships;
    private final UserRepository users;
    private final GroupAccessGuard guard;
    private final BalanceCalculator calculator;

    public BalanceServiceImpl(ExpenseRepository expenses, MembershipRepository memberships,
                              UserRepository users, GroupAccessGuard guard, BalanceCalculator calculator) {
        this.expenses = expenses;
        this.memberships = memberships;
        this.users = users;
        this.guard = guard;
        this.calculator = calculator;
    }

    @Override
    public BalancesResponse getBalances(String userId, String groupId) {
        GroupAccessGuard.Access access = guard.forRead(groupId, userId);
        return compute(groupId, access.group().getCurrency());
    }

    @Override
    public MemberBalanceResponse getBalance(String userId, String groupId, String targetUserId) {
        GroupAccessGuard.Access access = guard.forRead(groupId, userId);
        return compute(groupId, access.group().getCurrency()).members().stream()
                .filter(m -> m.userId().equals(targetUserId))
                .findFirst()
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Member not found"));
    }

    private BalancesResponse compute(String groupId, String currency) {
        List<Membership> members = memberships.findByGroupId(groupId).stream()
                .sorted(Comparator
                        .comparing((Membership m) -> m.getRole() != GroupRole.OWNER)
                        .thenComparing(Membership::getJoinedAt, Comparator.nullsLast(Comparator.<Instant>naturalOrder()))
                        .thenComparing(Membership::getUserId))
                .toList();
        List<String> memberIds = members.stream().map(Membership::getUserId).toList();

        Map<String, User> usersById = users.findAllById(memberIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        List<LedgerExpense> ledger = expenses.findByGroupIdAndStatus(groupId, ExpenseStatus.ACTIVE).stream()
                .map(e -> new LedgerExpense(e.getPaidBy(), e.getAmountMinor(), e.getShares().stream()
                        .map(s -> new ShareAllocation(s.userId(), s.shareMinor(), s.percentageBp()))
                        .toList()))
                .toList();

        // settlements are added in the next step; until then nothing has been sent or received
        Map<String, MemberBalance> balances = calculator.compute(memberIds, ledger, List.of());

        long sum = 0L;
        List<MemberBalanceResponse> response = new java.util.ArrayList<>();
        for (Membership m : members) {
            MemberBalance b = balances.get(m.getUserId());
            User user = usersById.get(m.getUserId());
            sum = Math.addExact(sum, b.netMinor());
            response.add(new MemberBalanceResponse(
                    m.getUserId(),
                    user != null ? user.getUsername() : UNKNOWN_USER,
                    user != null ? user.getFullName() : UNKNOWN_USER,
                    m.getStatus(),
                    b.paidMinor(), b.shareMinor(), b.sentMinor(), b.receivedMinor(), b.netMinor()));
        }
        return new BalancesResponse(currency, sum, List.copyOf(response));
    }
}
