package com.qisma.service.finance;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CustomSplitStrategyTest {

    private final CustomSplitStrategy strategy = new CustomSplitStrategy();

    private static List<Long> shares(List<ShareAllocation> allocations) {
        return allocations.stream().map(ShareAllocation::shareMinor).toList();
    }

    @Test
    void cahierExample_150_100_50() {
        var result = strategy.allocate(Money.of(30000L, "MAD"), List.of(
                ShareInput.custom("youssef", 15000L),
                ShareInput.custom("ahmed", 10000L),
                ShareInput.custom("hamza", 5000L)));
        assertEquals(List.of(15000L, 10000L, 5000L), shares(result));
        assertEquals(List.of("youssef", "ahmed", "hamza"),
                result.stream().map(ShareAllocation::userId).toList());
    }

    @Test

    void zeroShare_isAllowed() {
        var result = strategy.allocate(Money.of(300L, "MAD"),
                List.of(ShareInput.custom("a", 300L), ShareInput.custom("b", 0L)));
        assertEquals(List.of(300L, 0L), shares(result));
    }

    @Test
    void rejectsSumLowerThanTotal() {
        assertThrows(InvalidSplitException.class, () -> strategy.allocate(Money.of(300L, "MAD"),
                List.of(ShareInput.custom("a", 100L), ShareInput.custom("b", 100L))));
    }

    @Test
    void rejectsSumHigherThanTotal() {
        assertThrows(InvalidSplitException.class, () -> strategy.allocate(Money.of(300L, "MAD"),
                List.of(ShareInput.custom("a", 200L), ShareInput.custom("b", 200L))));
    }

    @Test
    void rejectsNegativeShare() {
        assertThrows(InvalidSplitException.class, () -> strategy.allocate(Money.of(300L, "MAD"),
                List.of(ShareInput.custom("a", 400L), ShareInput.custom("b", -100L))));
    }

    @Test
    void rejectsMissingShare() {
        assertThrows(InvalidSplitException.class, () -> strategy.allocate(Money.of(300L, "MAD"),
                List.of(ShareInput.custom("a", 300L), ShareInput.equal("b"))));
    }

    @Test
    void rejectsPercentageInCustomSplit() {

        assertThrows(InvalidSplitException.class, () -> strategy.allocate(Money.of(300L, "MAD"),
                List.of(ShareInput.custom("a", 300L), ShareInput.percentage("b", 5000))));
    }

    @Test
    void rejectsOverflowingSum() {
        assertThrows(InvalidSplitException.class, () -> strategy.allocate(Money.of(100L, "MAD"),
                List.of(ShareInput.custom("a", Long.MAX_VALUE), ShareInput.custom("b", 1L))));
    }

    @Test
    void rejectsDuplicateParticipants() {
        assertThrows(InvalidSplitException.class, () -> strategy.allocate(Money.of(100L, "MAD"),
                List.of(ShareInput.custom("a", 50L), ShareInput.custom("a", 50L))));
    }
}
