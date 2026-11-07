package com.qisma.service.impl;

import com.qisma.enums.ExpenseStatus;
import com.qisma.enums.GroupRole;
import com.qisma.enums.SettlementStatus;
import com.qisma.model.Membership;
import com.qisma.model.Settlement;
import com.qisma.repository.ExpenseRepository;
import com.qisma.repository.MembershipRepository;
import com.qisma.repository.SettlementRepository;
import com.qisma.service.GroupLedger;
import com.qisma.service.LedgerService;
import com.qisma.service.finance.BalanceCalculator;
import com.qisma.service.finance.LedgerExpense;
import com.qisma.service.finance.LedgerSettlement;
import com.qisma.service.finance.MemberBalance;
import com.qisma.service.finance.ShareAllocation;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * The one place where the group's money is computed. Balances are never stored: they are derived on every
 * call from the ACTIVE expenses and the CONFIRMED settlements. PENDING settlements do not change a balance;
 * they only produce the pendingOut / pendingIn figures. REJECTED and CANCELLED ones are never even read.
 * Every member takes part, active or not, so nobody who left loses a balance.
 */
@Service
public class LedgerServiceImpl implements LedgerService {

    private final ExpenseRepository expenses;
    private final MembershipRepository memberships;
    private final SettlementRepository settlements;
    private final BalanceCalculator calculator;

    public LedgerServiceImpl(ExpenseRepository expenses, MembershipRepository memberships,
                             SettlementRepository settlements, BalanceCalculator calculator) {
        this.expenses = expenses;
        this.memberships = memberships;
        this.settlements = settlements;
        this.calculator = calculator;
    }

    @Override
    public GroupLedger load(String groupId) {
        List<Membership> members = memberships.findByGroupId(groupId).stream()
                .sorted(Comparator
                        .comparing((Membership m) -> m.getRole() != GroupRole.OWNER)
                        .thenComparing(Membership::getJoinedAt, Comparator.nullsLast(Comparator.<Instant>naturalOrder()))
                        .thenComparing(Membership::getUserId))
                .toList();
        List<String> memberIds = members.stream().map(Membership::getUserId).toList();

        List<LedgerExpense> ledgerExpenses = expenses.findByGroupIdAndStatus(groupId, ExpenseStatus.ACTIVE).stream()
                .map(e -> new LedgerExpense(e.getPaidBy(), e.getAmountMinor(), e.getShares().stream()
                        .map(s -> new ShareAllocation(s.userId(), s.shareMinor(), s.percentageBp()))
                        .toList()))
                .toList();

        List<LedgerSettlement> confirmed = settlements.findByGroupIdAndStatus(groupId, SettlementStatus.CONFIRMED)
                .stream()
                .map(s -> new LedgerSettlement(s.getFromUserId(), s.getToUserId(), s.getAmountMinor()))
                .toList();

        Map<String, MemberBalance> balances = calculator.compute(memberIds, ledgerExpenses, confirmed);

        Map<String, Long> pendingOut = new HashMap<>();
        Map<String, Long> pendingIn = new HashMap<>();
        for (Settlement s : settlements.findByGroupIdAndStatus(groupId, SettlementStatus.PENDING)) {
            pendingOut.merge(s.getFromUserId(), s.getAmountMinor(), Math::addExact);
            pendingIn.merge(s.getToUserId(), s.getAmountMinor(), Math::addExact);
        }
        return new GroupLedger(members, balances, Map.copyOf(pendingOut), Map.copyOf(pendingIn));
    }
}
