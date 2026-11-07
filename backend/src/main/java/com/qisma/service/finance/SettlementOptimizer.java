package com.qisma.service.finance;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Greedy two-pointer debt settlement. Produces at most (non-zero balances - 1) transfers.
 * Deterministic: ties are broken by userId.
 */
public final class SettlementOptimizer {

    private record Entry(String userId, long amount) {
    }

    /**
     * @param effectiveNets userId -> net balance in minor units (positive = creditor, negative = debtor)
     * @throws LedgerInvariantViolation if the balances do not sum to zero
     */
    public List<TransferSuggestion> suggest(Map<String, Long> effectiveNets) {
        long sum = 0L;
        List<Entry> creditors = new ArrayList<>();
        List<Entry> debtors = new ArrayList<>();

        for (Map.Entry<String, Long> e : effectiveNets.entrySet()) {
            long net = e.getValue();
            sum = Math.addExact(sum, net);
            if (net > 0L) {
                creditors.add(new Entry(e.getKey(), net));
            } else if (net < 0L) {
                debtors.add(new Entry(e.getKey(), Math.negateExact(net)));
            }
        }

        if (sum != 0L) {
            throw new LedgerInvariantViolation("Balances sum to " + sum + " instead of 0");
        }

        Comparator<Entry> order = Comparator.comparingLong(Entry::amount).reversed()
                .thenComparing(Entry::userId);
        creditors.sort(order);
        debtors.sort(order);

        long[] creditorLeft = creditors.stream().mapToLong(Entry::amount).toArray();
        long[] debtorLeft = debtors.stream().mapToLong(Entry::amount).toArray();

        List<TransferSuggestion> result = new ArrayList<>();
        int d = 0;
        int c = 0;
        while (d < debtors.size() && c < creditors.size()) {
            long t = Math.min(debtorLeft[d], creditorLeft[c]);
            result.add(new TransferSuggestion(debtors.get(d).userId(), creditors.get(c).userId(), t));
            debtorLeft[d] -= t;
            creditorLeft[c] -= t;
            if (debtorLeft[d] == 0L) {
                d++;
            }
            if (creditorLeft[c] == 0L) {
                c++;
            }
        }
        return List.copyOf(result);
    }
}
