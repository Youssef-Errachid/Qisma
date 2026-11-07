package com.qisma.config;

import com.qisma.service.finance.SplitStrategyFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Exposes the pure-Java financial engine to Spring. */
@Configuration
public class FinanceConfig {

    @Bean
    SplitStrategyFactory splitStrategyFactory() {
        return new SplitStrategyFactory();
    }
}
