package com.qisma.service.finance;

import java.util.ArrayList;
import java.util.List;

public final class CustomSplitStrategy implements SplitStrategy {

    @Override
    public List<ShareAllocation> allocate(Money total, List<ShareInput> inputs) {
        SplitValidation.requireValidRequest(total, inputs);

        long sum = 0L;
        List<ShareAllocation> result = new ArrayList<>(inputs.size());

        for (ShareInput input : inputs) {
            if (input.percentageBp() != null) {
                throw new InvalidSplitException(
                        "CUSTOM split does not accept percentages (participant " + input.userId() + ")");
            }
            if (input.shareMinor() == null) {
                throw new InvalidSplitException(
                        "CUSTOM split requires an amount for participant " + input.userId());
            }
            long share = input.shareMinor();
            if (share < 0L) {
                throw new InvalidSplitException(
                        "Share must not be negative (participant " + input.userId() + ")");
            }
            try {
                sum = Math.addExact(sum, share);
            } catch (ArithmeticException e) {
                throw new InvalidSplitException("Sum of shares is too large");
            }
            result.add(new ShareAllocation(input.userId(), share, null));
        }

        if (sum != total.minorUnits()) {
            throw new InvalidSplitException(
                    "Shares must sum to " + total + " but sum to " + new Money(sum, total.currency()));
        }

        SplitValidation.requireSumEqualsTotal(total, result);
        return List.copyOf(result);
    }
}
