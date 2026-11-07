package com.qisma.service.finance;

import com.qisma.enums.SplitMethod;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SplitStrategyFactoryTest {

    @Test
    void returnsMatchingStrategyForEachMethod() {
        SplitStrategyFactory factory = new SplitStrategyFactory();
        assertInstanceOf(EqualSplitStrategy.class, factory.forMethod(SplitMethod.EQUAL));
        assertInstanceOf(CustomSplitStrategy.class, factory.forMethod(SplitMethod.CUSTOM));

        assertInstanceOf(PercentageSplitStrategy.class, factory.forMethod(SplitMethod.PERCENTAGE));
    }
}
