package com.qisma.service.finance;

import java.util.List;

public interface SplitStrategy {

    /**
     * @return one allocation per input, in the same order,
     *         whose shares sum exactly to total.minorUnits()
     * @throws InvalidSplitException if the request breaks a financial rule
     */
    List<ShareAllocation> allocate(Money total, List<ShareInput> inputs);
}
