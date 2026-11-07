package com.qisma.service.finance;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;

class SettlementOptimizerTest {

    private final SettlementOptimizer optimizer = new SettlementOptimizer();

    private static Map<String, Long> nets(Object... pairs) {
        Map<String, Long> m = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) {
            m.put((String) pairs[i], ((Number) pairs[i + 1]).longValue());
        }
        return m;
    }

    /** Applies the transfers to the balances and returns the resulting nets. */
    private static Map<String, Long> apply(Map<String, Long> nets, List<TransferSuggestion> transfers) {
        Map<String, Long> result = new LinkedHashMap<>(nets);
        for (TransferSuggestion t : transfers) {
            result.merge(t.fromUserId(), t.amountMinor(), Long::sum);   // debtor pays: net goes up

            result.merge(t.toUserId(), -t.amountMinor(), Long::sum);    // creditor receives: net goes down
        }
        return result;
    }

    @Test
    void cahierExample_200_minus120_minus80() {
        var result = optimizer.suggest(nets("youssef", 20000, "ahmed", -12000, "hamza", -8000));
        assertEquals(List.of(
                new TransferSuggestion("ahmed", "youssef", 12000L),
                new TransferSuggestion("hamza", "youssef", 8000L)), result);
    }

    @Test
    void allBalanced_givesNoTransfers() {
        assertTrue(optimizer.suggest(nets("a", 0, "b", 0)).isEmpty());
        assertTrue(optimizer.suggest(Map.of()).isEmpty());
    }

    @Test
    void oneDebtorOneCreditor_singleTransfer() {
        var result = optimizer.suggest(nets("a", 500, "b", -500));
        assertEquals(List.of(new TransferSuggestion("b", "a", 500L)), result);
    }

    @Test
    void debtorSplitsAcrossTwoCreditors() {
        var result = optimizer.suggest(nets("a", 300, "b", 200, "c", -500));
        assertEquals(List.of(
                new TransferSuggestion("c", "a", 300L),
                new TransferSuggestion("c", "b", 200L)), result);
    }


    @Test
    void cahierSection82_correctedBalances() {
        var n = nets("youssef", 8333, "ahmed", -6667, "hamza", -1666);
        var result = optimizer.suggest(n);
        assertEquals(2, result.size());
        apply(n, result).values().forEach(v -> assertEquals(0L, v));
    }

    @Test
    void tiesAreBrokenByUserId_deterministically() {
        var result = optimizer.suggest(nets("z", -100, "y", -100, "a", 100, "b", 100));
        assertEquals(List.of(
                new TransferSuggestion("y", "a", 100L),
                new TransferSuggestion("z", "b", 100L)), result);
    }

    @Test
    void rejectsBalancesNotSummingToZero() {
        assertThrows(LedgerInvariantViolation.class, () -> optimizer.suggest(nets("a", 100, "b", -50)));
    }

    @Test
    void transferRecordRejectsInvalidValues() {
        assertThrows(IllegalArgumentException.class, () -> new TransferSuggestion("a", "a", 10L));
        assertThrows(IllegalArgumentException.class, () -> new TransferSuggestion("a", "b", 0L));
    }

    @Test
    void property_applyingSuggestionsZeroesEverything_withBoundedTransferCount() {
        Random random = new Random(99);
        for (int round = 0; round < 3000; round++) {

            int n = 2 + random.nextInt(12);
            Map<String, Long> m = new LinkedHashMap<>();
            long sum = 0L;
            for (int i = 0; i < n - 1; i++) {
                long v = random.nextInt(200_001) - 100_000;
                m.put("u" + i, v);
                sum += v;
            }
            m.put("u" + (n - 1), -sum);

            var result = optimizer.suggest(m);

            final int r = round;
            apply(m, result).values().forEach(v -> assertEquals(0L, v, "round " + r));
            long nonZero = m.values().stream().filter(v -> v != 0L).count();
            assertTrue(result.size() <= Math.max(0, nonZero - 1), "too many transfers in round " + round);
            assertEquals(result, optimizer.suggest(m), "not deterministic");
        }
    }
}
