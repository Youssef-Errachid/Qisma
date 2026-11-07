package com.qisma.service.finance;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Splits by percentages expressed in basis points (10000 = 100%),
 * distributing the leftover minor units with the Largest Remainder Method.
 */
public final class PercentageSplitStrategy implements SplitStrategy {

    static final int TOTAL_BP = 10_000;

    @Override
    public List<ShareAllocation> allocate(Money total, List<ShareInput> inputs) {
        SplitValidation.requireValidRequest(total, inputs);

        int n = inputs.size();
        long bpSum = 0L;
        for (ShareInput input : inputs) {
            if (input.shareMinor() != null) {
                throw new InvalidSplitException(
                        "PERCENTAGE split does not accept amounts (participant " + input.userId() + ")");
            }
            if (input.percentageBp() == null) {
                throw new InvalidSplitException(
                        "PERCENTAGE split requires a percentage for participant " + input.userId());
            }
            int bp = input.percentageBp();
            if (bp < 0 || bp > TOTAL_BP) {
                throw new InvalidSplitException(
                        "Percentage must be between 0 and 100% (participant " + input.userId() + ")");
            }
            bpSum += bp;
        }
        if (bpSum != TOTAL_BP) {
            throw new InvalidSplitException("Percentages must total exactly 100% but total " + bpSum + " bp");
        }

        BigInteger amount = BigInteger.valueOf(total.minorUnits());
        BigInteger divisor = BigInteger.valueOf(TOTAL_BP);

        long[] floors = new long[n];
        int[] remainders = new int[n];
        long floorSum = 0L;

        for (int i = 0; i < n; i++) {
            BigInteger product = amount.multiply(BigInteger.valueOf(inputs.get(i).percentageBp()));
            BigInteger[] qr = product.divideAndRemainder(divisor);
            floors[i] = qr[0].longValueExact();
            remainders[i] = qr[1].intValueExact();
            floorSum += floors[i];
        }

        long leftover = total.minorUnits() - floorSum; // always 0 <= leftover < n

        List<Integer> order = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            order.add(i);
        }
        // largest fractional remainder first; ties -> earlier in submission order
        order.sort(Comparator.<Integer>comparingInt(i -> -remainders[i]).thenComparingInt(i -> i));

        for (int k = 0; k < leftover; k++) {
            floors[order.get(k)] += 1L;
        }

        List<ShareAllocation> result = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            ShareInput input = inputs.get(i);
            result.add(new ShareAllocation(input.userId(), floors[i], input.percentageBp()));
        }

        SplitValidation.requireSumEqualsTotal(total, result);
        return List.copyOf(result);
    }
}
