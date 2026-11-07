package com.qisma.service.finance;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

final class SplitValidation {

    private SplitValidation() {
    }

    static void requireValidRequest(Money total, List<ShareInput> inputs) {
        if (total == null || !total.isPositive()) {
            throw new InvalidSplitException("Total amount must be greater than zero");
        }
        if (inputs == null || inputs.isEmpty()) {
            throw new InvalidSplitException("At least one participant is required");
        }
        Set<String> seen = new HashSet<>();
        for (ShareInput input : inputs) {
            if (!seen.add(input.userId())) {
                throw new InvalidSplitException("Duplicate participant: " + input.userId());
            }
        }
    }

    /** Final safety net: shares must add up to the total, exactly. */
    static void requireSumEqualsTotal(Money total, List<ShareAllocation> shares) {
        long sum = 0L;
        for (ShareAllocation share : shares) {
            sum = Math.addExact(sum, share.shareMinor());
        }
        if (sum != total.minorUnits()) {
            throw new IllegalStateException(
                    "Split invariant broken: shares sum to " + sum + " but total is " + total.minorUnits());
        }
    }
}
