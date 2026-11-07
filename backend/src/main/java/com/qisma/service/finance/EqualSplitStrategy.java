package com.qisma.service.finance;

import java.util.ArrayList;
import java.util.List;

public final class EqualSplitStrategy implements SplitStrategy {

    @Override
    public List<ShareAllocation> allocate(Money total, List<ShareInput> inputs) {
        SplitValidation.requireValidRequest(total, inputs);

        for (ShareInput input : inputs) {
            if (input.shareMinor() != null || input.percentageBp() != null) {
                throw new InvalidSplitException(
                        "EQUAL split does not accept amounts or percentages (participant " + input.userId() + ")");
            }
        }

        int n = inputs.size();
        long base = total.minorUnits() / n;
        long remainder = total.minorUnits() % n;

        List<ShareAllocation> result = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            long share = base + (i < remainder ? 1L : 0L);
            result.add(new ShareAllocation(inputs.get(i).userId(), share, null));
        }

        SplitValidation.requireSumEqualsTotal(total, result);
        return List.copyOf(result);
    }
}
