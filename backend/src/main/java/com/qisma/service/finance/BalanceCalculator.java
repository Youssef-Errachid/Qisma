package com.qisma.service.finance;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Computes member balances from ACTIVE expenses and CONFIRMED settlements.
 * The caller is responsible for filtering by status and for passing every member
 * (active or not) so that nobody's balance is lost.
 */
public final class BalanceCalculator {

    private static final int PAID = 0;
    private static final int SHARE = 1;
    private static final int SENT = 2;
    private static final int RECEIVED = 3;

    public Map<String, MemberBalance> compute(Collection<String> memberIds,
                                              List<LedgerExpense> expenses,
                                              List<LedgerSettlement> confirmedSettlements) {
        Map<String, long[]> acc = new LinkedHashMap<>();
        for (String id : memberIds) {
            if (id == null || id.isBlank()) {
                throw new IllegalArgumentException("member id must not be blank");
            }
            acc.putIfAbsent(id, new long[4]);
        }

        for (LedgerExpense expense : expenses) {
            add(acc, expense.paidBy(), PAID, expense.amountMinor());
            for (ShareAllocation share : expense.shares()) {
                add(acc, share.userId(), SHARE, share.shareMinor());
            }
        }

        for (LedgerSettlement settlement : confirmedSettlements) {
            add(acc, settlement.fromUserId(), SENT, settlement.amountMinor());
            add(acc, settlement.toUserId(), RECEIVED, settlement.amountMinor());
        }

        Map<String, MemberBalance> result = new LinkedHashMap<>();
        long netSum = 0L;
        for (Map.Entry<String, long[]> entry : acc.entrySet()) {
            long[] v = entry.getValue();
            MemberBalance balance = new MemberBalance(entry.getKey(), v[PAID], v[SHARE], v[SENT], v[RECEIVED]);
            netSum = Math.addExact(netSum, balance.netMinor());
            result.put(entry.getKey(), balance);
        }

        if (netSum != 0L) {
            throw new LedgerInvariantViolation("Sum of net balances is " + netSum + " instead of 0");
        }
        return Collections.unmodifiableMap(result);
    }

    private static void add(Map<String, long[]> acc, String userId, int slot, long amount) {
        long[] values = acc.get(userId);
        if (values == null) {
            throw new IllegalArgumentException("Unknown member in ledger: " + userId);
        }
        values[slot] = Math.addExact(values[slot], amount);
    }
}
