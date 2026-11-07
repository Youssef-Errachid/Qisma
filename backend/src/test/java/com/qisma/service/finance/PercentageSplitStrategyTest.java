package com.qisma.service.finance;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;

class PercentageSplitStrategyTest {

    private final PercentageSplitStrategy strategy = new PercentageSplitStrategy();


    private static List<Long> shares(List<ShareAllocation> allocations) {
        return allocations.stream().map(ShareAllocation::shareMinor).toList();
    }

    @Test
    void cahierExample_400_with_50_30_20() {
        var result = strategy.allocate(Money.of(40000L, "MAD"), List.of(
                ShareInput.percentage("youssef", 5000),
                ShareInput.percentage("ahmed", 3000),
                ShareInput.percentage("hamza", 2000)));
        assertEquals(List.of(20000L, 12000L, 8000L), shares(result));
    }

    @Test
    void largestRemainder_distributesLeftoverUnits() {
        // 1001 with 33.33 / 33.33 / 33.34 -> floors 333/333/333, leftover 2
        var result = strategy.allocate(Money.of(1001L, "MAD"), List.of(
                ShareInput.percentage("a", 3333),
                ShareInput.percentage("b", 3333),
                ShareInput.percentage("c", 3334)));
        assertEquals(List.of(334L, 333L, 334L), shares(result));
    }

    @Test
    void tie_goesToEarlierParticipant() {
        var result = strategy.allocate(Money.of(1L, "MAD"),
                List.of(ShareInput.percentage("a", 5000), ShareInput.percentage("b", 5000)));
        assertEquals(List.of(1L, 0L), shares(result));
    }

    @Test

    void zeroPercent_getsZero() {
        var result = strategy.allocate(Money.of(1000L, "MAD"),
                List.of(ShareInput.percentage("a", 10000), ShareInput.percentage("b", 0)));
        assertEquals(List.of(1000L, 0L), shares(result));
    }

    @Test
    void allocation_keepsPercentageBp() {
        var result = strategy.allocate(Money.of(1000L, "MAD"),
                List.of(ShareInput.percentage("a", 7000), ShareInput.percentage("b", 3000)));
        assertEquals(7000, result.get(0).percentageBp());
        assertEquals(3000, result.get(1).percentageBp());
    }

    @Test
    void rejectsPercentagesNotTotalling100() {
        assertThrows(InvalidSplitException.class, () -> strategy.allocate(Money.of(1000L, "MAD"),
                List.of(ShareInput.percentage("a", 5000), ShareInput.percentage("b", 4999))));
        assertThrows(InvalidSplitException.class, () -> strategy.allocate(Money.of(1000L, "MAD"),
                List.of(ShareInput.percentage("a", 5000), ShareInput.percentage("b", 5001))));
    }

    @Test
    void rejectsNegativePercentage() {
        assertThrows(InvalidSplitException.class, () -> strategy.allocate(Money.of(1000L, "MAD"),
                List.of(ShareInput.percentage("a", 11000), ShareInput.percentage("b", -1000))));
    }

    @Test
    void rejectsMissingPercentage() {
        assertThrows(InvalidSplitException.class, () -> strategy.allocate(Money.of(1000L, "MAD"),
                List.of(ShareInput.percentage("a", 10000), ShareInput.equal("b"))));

    }

    @Test
    void rejectsAmountInPercentageSplit() {
        assertThrows(InvalidSplitException.class, () -> strategy.allocate(Money.of(1000L, "MAD"),
                List.of(ShareInput.percentage("a", 10000), ShareInput.custom("b", 5L))));
    }

    @Test
    void hugeTotal_doesNotOverflow() {
        var result = strategy.allocate(Money.of(Long.MAX_VALUE, "MAD"),
                List.of(ShareInput.percentage("a", 5000), ShareInput.percentage("b", 5000)));
        assertEquals(Long.MAX_VALUE, result.stream().mapToLong(ShareAllocation::shareMinor).sum());
    }

    @Test
    void property_sumEqualsTotal_andEachShareWithinOneUnitOfExact() {
        Random random = new Random(42);
        for (int round = 0; round < 5000; round++) {
            long total = 1 + random.nextInt(1_000_000);
            int n = 1 + random.nextInt(10);

            // random percentages in bp that sum to exactly 10000
            int[] cuts = new int[n + 1];
            cuts[n] = 10000;
            for (int i = 1; i < n; i++) cuts[i] = random.nextInt(10001);
            java.util.Arrays.sort(cuts);

            List<ShareInput> inputs = new ArrayList<>();
            for (int i = 0; i < n; i++) {
                inputs.add(ShareInput.percentage("u" + i, cuts[i + 1] - cuts[i]));
            }


            var result = strategy.allocate(Money.of(total, "MAD"), inputs);

            assertEquals(total, result.stream().mapToLong(ShareAllocation::shareMinor).sum(),
                    "sum broken in round " + round);
            for (int i = 0; i < n; i++) {
                long exactFloor = total * inputs.get(i).percentageBp() / 10000;
                long share = result.get(i).shareMinor();
                assertTrue(share == exactFloor || share == exactFloor + 1,
                        "share too far from exact in round " + round);
            }
            assertEquals(result, strategy.allocate(Money.of(total, "MAD"), inputs), "not deterministic");
        }
    }
}
