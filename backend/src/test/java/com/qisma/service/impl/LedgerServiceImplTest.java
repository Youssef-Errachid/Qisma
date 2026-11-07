package com.qisma.service.impl;

import com.qisma.enums.ExpenseStatus;
import com.qisma.enums.GroupRole;
import com.qisma.enums.SettlementStatus;
import com.qisma.model.Expense;
import com.qisma.model.ExpenseShare;
import com.qisma.model.Membership;
import com.qisma.model.Settlement;
import com.qisma.repository.ExpenseRepository;
import com.qisma.repository.MembershipRepository;
import com.qisma.repository.SettlementRepository;
import com.qisma.service.GroupLedger;
import com.qisma.service.finance.BalanceCalculator;
import com.qisma.service.finance.EqualSplitStrategy;
import com.qisma.service.finance.Money;
import com.qisma.service.finance.ShareInput;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class LedgerServiceImplTest {

    private static final Instant T0 = Instant.parse("2026-11-01T10:00:00Z");

    private ExpenseRepository expenses;
    private MembershipRepository memberships;
    private SettlementRepository settlements;
    private LedgerServiceImpl service;

    @BeforeEach
    void setUp() {
        expenses = mock(ExpenseRepository.class);
        memberships = mock(MembershipRepository.class);
        settlements = mock(SettlementRepository.class);
        service = new LedgerServiceImpl(expenses, memberships, settlements, new BalanceCalculator());

        when(memberships.findByGroupId("g1")).thenReturn(List.of(
                new Membership("g1", "youssef", GroupRole.OWNER, T0),
                new Membership("g1", "ahmed", GroupRole.MEMBER, T0.plusSeconds(10)),
                new Membership("g1", "hamza", GroupRole.MEMBER, T0.plusSeconds(20))));
    }

    private static Expense expense(String paidBy, long amount, ExpenseShare... shares) {
        Expense e = new Expense();
        e.setPaidBy(paidBy);
        e.setAmountMinor(amount);
        e.setStatus(ExpenseStatus.ACTIVE);
        e.setShares(List.of(shares));
        return e;
    }

    private static Settlement settlement(String from, String to, long amount) {
        Settlement s = new Settlement();
        s.setGroupId("g1");
        s.setFromUserId(from);
        s.setToUserId(to);
        s.setAmountMinor(amount);
        return s;
    }

    /** youssef +8333, ahmed -6667, hamza -1666 (cahier section 8.2, corrected). */
    private void cahierExpenses() {
        when(expenses.findByGroupIdAndStatus("g1", ExpenseStatus.ACTIVE)).thenReturn(List.of(
                expense("youssef", 30000, new ExpenseShare("youssef", 10000, null),
                        new ExpenseShare("ahmed", 10000, null), new ExpenseShare("hamza", 10000, null)),
                expense("ahmed", 15000, new ExpenseShare("youssef", 5000, null),
                        new ExpenseShare("ahmed", 5000, null), new ExpenseShare("hamza", 5000, null)),
                expense("hamza", 20000, new ExpenseShare("youssef", 6667, null),
                        new ExpenseShare("ahmed", 6667, null), new ExpenseShare("hamza", 6666, null))));
    }

    @Test
    void aConfirmedSettlement_changesTheBalances() {
        cahierExpenses();
        when(settlements.findByGroupIdAndStatus("g1", SettlementStatus.CONFIRMED))
                .thenReturn(List.of(settlement("ahmed", "youssef", 6667)));

        GroupLedger ledger = service.load("g1");

        assertEquals(0L, ledger.balances().get("ahmed").netMinor());
        assertEquals(1666L, ledger.balances().get("youssef").netMinor());
        assertEquals(6667L, ledger.balances().get("ahmed").sentMinor());
        assertEquals(6667L, ledger.balances().get("youssef").receivedMinor());
    }

    @Test
    void aPendingSettlement_doesNotChangeTheBalance_butChangesTheEffectiveOne() {
        cahierExpenses();
        when(settlements.findByGroupIdAndStatus("g1", SettlementStatus.PENDING))
                .thenReturn(List.of(settlement("ahmed", "youssef", 3000)));

        GroupLedger ledger = service.load("g1");

        assertEquals(-6667L, ledger.balances().get("ahmed").netMinor());
        assertEquals(8333L, ledger.balances().get("youssef").netMinor());
        assertEquals(3000L, ledger.pendingOutOf("ahmed"));
        assertEquals(3000L, ledger.pendingInOf("youssef"));
        assertEquals(-3667L, ledger.effectiveNetOf("ahmed"));
        assertEquals(5333L, ledger.effectiveNetOf("youssef"));
        assertEquals(-1666L, ledger.effectiveNetOf("hamza"));
    }

    @Test
    void pendingAmountsOfTheSameMemberAreAdded() {
        cahierExpenses();
        when(settlements.findByGroupIdAndStatus("g1", SettlementStatus.PENDING))
                .thenReturn(List.of(settlement("ahmed", "youssef", 1000), settlement("ahmed", "hamza", 2000)));

        GroupLedger ledger = service.load("g1");

        assertEquals(3000L, ledger.pendingOutOf("ahmed"));
        assertEquals(1000L, ledger.pendingInOf("youssef"));
        assertEquals(2000L, ledger.pendingInOf("hamza"));
        assertEquals(0L, ledger.pendingOutOf("youssef"));
    }

    @Test
    void onlyConfirmedAndPendingSettlementsAreEverRead() {
        cahierExpenses();
        service.load("g1");

        verify(settlements).findByGroupIdAndStatus("g1", SettlementStatus.CONFIRMED);
        verify(settlements).findByGroupIdAndStatus("g1", SettlementStatus.PENDING);
        verify(settlements, never()).findByGroupIdAndStatus("g1", SettlementStatus.REJECTED);
        verify(settlements, never()).findByGroupIdAndStatus("g1", SettlementStatus.CANCELLED);
        verify(settlements, never()).findAll();
    }

    @Test
    void aSettlementOfAStranger_isNotHidden() {
        cahierExpenses();
        when(settlements.findByGroupIdAndStatus("g1", SettlementStatus.CONFIRMED))
                .thenReturn(List.of(settlement("ahmed", "nobody", 100)));

        assertThrows(IllegalArgumentException.class, () -> service.load("g1"));
    }

    @Test
    void aCorruptSettlement_isNotHidden() {
        cahierExpenses();
        when(settlements.findByGroupIdAndStatus("g1", SettlementStatus.CONFIRMED))
                .thenReturn(List.of(settlement("ahmed", "ahmed", 100)));

        assertThrows(IllegalArgumentException.class, () -> service.load("g1"));
    }

    @Test
    void property_theEffectiveBalancesAlwaysAddUpToZero() {
        EqualSplitStrategy equal = new EqualSplitStrategy();
        Random random = new Random(11);
        List<String> ids = List.of("youssef", "ahmed", "hamza");

        for (int round = 0; round < 2000; round++) {
            List<Expense> generated = new ArrayList<>();
            for (int i = random.nextInt(15); i > 0; i--) {
                String payer = ids.get(random.nextInt(3));
                List<String> participants = new ArrayList<>(ids);
                Collections.shuffle(participants, random);
                participants = participants.subList(0, 1 + random.nextInt(3));
                long amount = 1 + random.nextInt(100_000);
                Expense e = new Expense();
                e.setPaidBy(payer);
                e.setAmountMinor(amount);
                e.setStatus(ExpenseStatus.ACTIVE);
                e.setShares(equal.allocate(Money.of(amount, "MAD"),
                        participants.stream().map(ShareInput::equal).toList()).stream()
                        .map(a -> new ExpenseShare(a.userId(), a.shareMinor(), null)).toList());
                generated.add(e);
            }
            when(expenses.findByGroupIdAndStatus("g1", ExpenseStatus.ACTIVE)).thenReturn(generated);

            List<Settlement> confirmed = new ArrayList<>();
            List<Settlement> pending = new ArrayList<>();
            for (int i = random.nextInt(6); i > 0; i--) {
                int from = random.nextInt(3);
                int to = (from + 1 + random.nextInt(2)) % 3;
                (random.nextBoolean() ? confirmed : pending)
                        .add(settlement(ids.get(from), ids.get(to), 1 + random.nextInt(5000)));
            }
            when(settlements.findByGroupIdAndStatus("g1", SettlementStatus.CONFIRMED)).thenReturn(confirmed);
            when(settlements.findByGroupIdAndStatus("g1", SettlementStatus.PENDING)).thenReturn(pending);

            GroupLedger ledger = service.load("g1");

            long net = ids.stream().mapToLong(id -> ledger.balances().get(id).netMinor()).sum();
            long effective = ids.stream().mapToLong(ledger::effectiveNetOf).sum();
            assertEquals(0L, net, "net broken in round " + round);
            assertEquals(0L, effective, "effective broken in round " + round);
        }
    }
}
