package com.qisma.service.finance;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;

class BalanceCalculatorTest {

    private final BalanceCalculator calculator = new BalanceCalculator();
    private final EqualSplitStrategy equal = new EqualSplitStrategy();

    private static final List<String> MEMBERS = List.of("youssef", "ahmed", "hamza");

    private LedgerExpense equalExpense(String paidBy, long amountMinor, String... participants) {
        List<ShareInput> inputs = java.util.Arrays.stream(participants).map(ShareInput::equal).toList();
        return new LedgerExpense(paidBy, amountMinor, equal.allocate(Money.of(amountMinor, "MAD"), inputs));
    }

    private List<LedgerExpense> cahierExpenses() {
        return List.of(
                equalExpense("youssef", 30000L, "youssef", "ahmed", "hamza"),
                equalExpense("ahmed", 15000L, "youssef", "ahmed", "hamza"),
                equalExpense("hamza", 20000L, "youssef", "ahmed", "hamza"));
    }

    private static long sumNet(Map<String, MemberBalance> balances) {
        return balances.values().stream().mapToLong(MemberBalance::netMinor).sum();
    }

    @Test
    void cahierExample_withCorrectedNumbers() {
        var b = calculator.compute(MEMBERS, cahierExpenses(), List.of());

        assertEquals(30000L, b.get("youssef").paidMinor());
        assertEquals(21667L, b.get("youssef").shareMinor());
        assertEquals(8333L, b.get("youssef").netMinor());

        assertEquals(-6667L, b.get("ahmed").netMinor());
        assertEquals(21667L, b.get("ahmed").shareMinor());

        assertEquals(-1666L, b.get("hamza").netMinor());
        assertEquals(21666L, b.get("hamza").shareMinor());

        assertEquals(0L, sumNet(b));
    }

    @Test
    void confirmedSettlement_reducesDebtAndCredit() {
        var b = calculator.compute(MEMBERS, cahierExpenses(),
                List.of(new LedgerSettlement("ahmed", "youssef", 6667L)));

        assertEquals(0L, b.get("ahmed").netMinor());
        assertEquals(1666L, b.get("youssef").netMinor());
        assertEquals(-1666L, b.get("hamza").netMinor());
        assertEquals(0L, sumNet(b));
    }

    @Test
    void fullSettlement_bringsEveryoneToZero() {
        var b = calculator.compute(MEMBERS, cahierExpenses(), List.of(
                new LedgerSettlement("ahmed", "youssef", 6667L),
                new LedgerSettlement("hamza", "youssef", 1666L)));

        b.values().forEach(m -> assertEquals(0L, m.netMinor(), m.userId()));
    }

    @Test
    void payerWhoIsNotAParticipant_isFullyOwed() {
        var b = calculator.compute(MEMBERS,
                List.of(equalExpense("youssef", 30000L, "ahmed", "hamza")), List.of());

        assertEquals(30000L, b.get("youssef").netMinor());
        assertEquals(-15000L, b.get("ahmed").netMinor());
        assertEquals(-15000L, b.get("hamza").netMinor());
        assertEquals(0L, sumNet(b));
    }

    @Test
    void payerWhoIsTheOnlyParticipant_netsToZero() {
        var b = calculator.compute(MEMBERS, List.of(equalExpense("ahmed", 5000L, "ahmed")), List.of());
        assertEquals(0L, b.get("ahmed").netMinor());
        assertEquals(5000L, b.get("ahmed").paidMinor());
    }

    @Test
    void memberWithoutActivity_hasZeroBalance_andOrderIsPreserved() {
        var b = calculator.compute(MEMBERS,
                List.of(equalExpense("youssef", 1000L, "youssef")), List.of());

        assertEquals(List.of("youssef", "ahmed", "hamza"), List.copyOf(b.keySet()));
        assertEquals(0L, b.get("hamza").netMinor());
    }

    @Test
    void noActivity_givesAllZero() {
        var b = calculator.compute(MEMBERS, List.of(), List.of());
        assertEquals(3, b.size());
        b.values().forEach(m -> assertEquals(0L, m.netMinor()));
    }

    @Test
    void rejectsUnknownPayerOrParticipantOrSettlementUser() {
        assertThrows(IllegalArgumentException.class, () -> calculator.compute(MEMBERS,
                List.of(equalExpense("ghost", 1000L, "youssef")), List.of()));
        assertThrows(IllegalArgumentException.class, () -> calculator.compute(MEMBERS,
                List.of(equalExpense("youssef", 1000L, "ghost")), List.of()));
        assertThrows(IllegalArgumentException.class, () -> calculator.compute(MEMBERS,
                List.of(), List.of(new LedgerSettlement("youssef", "ghost", 100L))));
    }

    @Test
    void expenseWhoseSharesDoNotMatchAmount_cannotBeCreated() {
        assertThrows(LedgerInvariantViolation.class, () -> new LedgerExpense("youssef", 1000L,
                List.of(new ShareAllocation("youssef", 400L, null), new ShareAllocation("ahmed", 500L, null))));
        assertThrows(LedgerInvariantViolation.class, () -> new LedgerExpense("youssef", 1000L, List.of()));
    }

    @Test
    void invalidExpensesAndSettlements_areRejected() {
        assertThrows(IllegalArgumentException.class, () -> new LedgerExpense("youssef", 0L,
                List.of(new ShareAllocation("youssef", 0L, null))));
        assertThrows(IllegalArgumentException.class, () -> new LedgerSettlement("a", "a", 100L));
        assertThrows(IllegalArgumentException.class, () -> new LedgerSettlement("a", "b", 0L));
        assertThrows(IllegalArgumentException.class, () -> new LedgerSettlement("a", "b", -5L));
    }

    @Test
    void netFormula_includesSentAndReceived() {
        MemberBalance m = new MemberBalance("x", 1000L, 400L, 50L, 20L);
        assertEquals(630L, m.netMinor()); // 1000 - 400 + 50 - 20
    }

    @Test
    void property_sumOfNetsIsAlwaysZero() {
        Random random = new Random(7);
        for (int round = 0; round < 2000; round++) {
            int memberCount = 2 + random.nextInt(8);
            List<String> members = new ArrayList<>();
            for (int i = 0; i < memberCount; i++) members.add("u" + i);

            List<LedgerExpense> expenses = new ArrayList<>();
            int expenseCount = random.nextInt(25);
            for (int e = 0; e < expenseCount; e++) {
                String payer = members.get(random.nextInt(memberCount));
                List<String> participants = new ArrayList<>(members);
                Collections.shuffle(participants, random);
                participants = participants.subList(0, 1 + random.nextInt(memberCount));
                long amount = 1 + random.nextInt(100_000);
                expenses.add(new LedgerExpense(payer, amount, equal.allocate(
                        Money.of(amount, "MAD"), participants.stream().map(ShareInput::equal).toList())));
            }

            List<LedgerSettlement> settlements = new ArrayList<>();
            int settlementCount = random.nextInt(10);
            for (int s = 0; s < settlementCount; s++) {
                int from = random.nextInt(memberCount);
                int to = (from + 1 + random.nextInt(memberCount - 1)) % memberCount;
                settlements.add(new LedgerSettlement(members.get(from), members.get(to), 1 + random.nextInt(5000)));
            }

            var balances = calculator.compute(members, expenses, settlements);
            assertEquals(0L, sumNet(balances), "invariant broken in round " + round);
        }
    }
}