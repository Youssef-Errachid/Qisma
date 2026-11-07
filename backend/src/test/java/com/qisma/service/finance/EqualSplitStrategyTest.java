package com.qisma.service.finance;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class EqualSplitStrategyTest {

    private final EqualSplitStrategy strategy = new EqualSplitStrategy();

    private static List<ShareInput> users(String... ids) {
        return java.util.Arrays.stream(ids).map(ShareInput::equal).toList();
    }


    private static List<Long> shares(List<ShareAllocation> allocations) {
        return allocations.stream().map(ShareAllocation::shareMinor).toList();
    }

    @Test
    void divisibleAmount_isSplitEvenly() {
        var result = strategy.allocate(Money.of(30000L, "MAD"), users("youssef", "ahmed", "hamza"));
        assertEquals(List.of(10000L, 10000L, 10000L), shares(result));
    }

    @Test
    void remainder_goesToFirstParticipants_inSubmissionOrder() {
        var result = strategy.allocate(Money.of(10000L, "MAD"), users("a", "b", "c"));
        assertEquals(List.of(3334L, 3333L, 3333L), shares(result));
        assertEquals(List.of("a", "b", "c"), result.stream().map(ShareAllocation::userId).toList());
    }

    @Test
    void remainderOfTwo_goesToFirstTwo() {
        var result = strategy.allocate(Money.of(1002L, "MAD"), users("a", "b", "c", "d"));
        assertEquals(List.of(251L, 251L, 250L, 250L), shares(result));
    }

    @Test
    void singleParticipant_bearsEverything() {
        var result = strategy.allocate(Money.of(12345L, "MAD"), users("solo"));
        assertEquals(List.of(12345L), shares(result));
    }

    @Test
    void amountSmallerThanParticipants_givesZeroToLast() {
        var result = strategy.allocate(Money.of(2L, "MAD"), users("a", "b", "c"));

        assertEquals(List.of(1L, 1L, 0L), shares(result));
    }

    @Test
    void isDeterministic_sameInputSameOutput() {
        var first = strategy.allocate(Money.of(9999L, "MAD"), users("a", "b", "c", "d", "e"));
        var second = strategy.allocate(Money.of(9999L, "MAD"), users("a", "b", "c", "d", "e"));
        assertEquals(first, second);
    }

    @Test
    void property_sumAlwaysEqualsTotal_andSharesDifferByAtMostOne() {
        for (long total = 1; total <= 2000; total++) {
            for (int n = 1; n <= 20; n++) {
                String[] ids = new String[n];
                for (int i = 0; i < n; i++) ids[i] = "u" + i;

                var result = strategy.allocate(Money.of(total, "MAD"), users(ids));

                long sum = result.stream().mapToLong(ShareAllocation::shareMinor).sum();
                long max = result.stream().mapToLong(ShareAllocation::shareMinor).max().orElseThrow();
                long min = result.stream().mapToLong(ShareAllocation::shareMinor).min().orElseThrow();

                assertEquals(total, sum, "sum broken for total=" + total + " n=" + n);
                assertTrue(max - min <= 1, "unfair split for total=" + total + " n=" + n);
            }
        }
    }

    @Test
    void rejectsNonPositiveTotal() {
        assertThrows(InvalidSplitException.class, () -> strategy.allocate(Money.of(0L, "MAD"), users("a")));

        assertThrows(InvalidSplitException.class, () -> strategy.allocate(Money.of(-100L, "MAD"), users("a")));
    }

    @Test
    void rejectsEmptyParticipants() {
        assertThrows(InvalidSplitException.class, () -> strategy.allocate(Money.of(100L, "MAD"), List.of()));
    }

    @Test
    void rejectsDuplicateParticipants() {
        assertThrows(InvalidSplitException.class,
                () -> strategy.allocate(Money.of(100L, "MAD"), users("a", "a")));
    }

    @Test
    void rejectsBlankUserId() {
        assertThrows(InvalidSplitException.class, () -> ShareInput.equal("  "));
    }

    @Test
    void rejectsAmountsOrPercentagesInEqualSplit() {
        assertThrows(InvalidSplitException.class, () -> strategy.allocate(
                Money.of(100L, "MAD"), List.of(ShareInput.custom("a", 50L), ShareInput.equal("b"))));
        assertThrows(InvalidSplitException.class, () -> strategy.allocate(
                Money.of(100L, "MAD"), List.of(ShareInput.percentage("a", 5000), ShareInput.equal("b"))));
    }
}
