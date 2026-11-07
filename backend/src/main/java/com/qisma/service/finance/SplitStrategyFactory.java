package com.qisma.service.finance;

import com.qisma.enums.SplitMethod;

import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;

public final class SplitStrategyFactory {

    private final Map<SplitMethod, SplitStrategy> strategies = new EnumMap<>(SplitMethod.class);

    public SplitStrategyFactory() {
        strategies.put(SplitMethod.EQUAL, new EqualSplitStrategy());
        strategies.put(SplitMethod.CUSTOM, new CustomSplitStrategy());
        strategies.put(SplitMethod.PERCENTAGE, new PercentageSplitStrategy());
    }

    public SplitStrategy forMethod(SplitMethod method) {
        Objects.requireNonNull(method, "method must not be null");
        return strategies.get(method);
    }
}
