package com.qisma.security;

import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.*;

class AttemptLimiterTest {

    private RefreshTokenServiceTest.TestClock clock;
    private AttemptLimiter limiter;

    @BeforeEach
    void setUp() {
        clock = new RefreshTokenServiceTest.TestClock();

        limiter = new AttemptLimiter(clock);
    }

    private void fail(String key, int times) {
        for (int i = 0; i < times; i++) {
            limiter.recordFailure(key);
        }
    }

    @Test
    void blocksAfterTheMaximumNumberOfFailures() {
        fail("u1", AttemptLimiter.MAX_FAILURES - 1);
        assertDoesNotThrow(() -> limiter.checkAllowed("u1"));

        fail("u1", 1);
        ApiException e = assertThrows(ApiException.class, () -> limiter.checkAllowed("u1"));
        assertEquals(ErrorCode.TOO_MANY_ATTEMPTS, e.getCode());
    }

    @Test
    void allowsAgainOnceTheWindowHasPassed() {
        fail("u1", AttemptLimiter.MAX_FAILURES);
        assertThrows(ApiException.class, () -> limiter.checkAllowed("u1"));

        clock.now = clock.now.plus(AttemptLimiter.WINDOW).plus(Duration.ofSeconds(1));
        assertDoesNotThrow(() -> limiter.checkAllowed("u1"));
    }

    @Test
    void usersAreIndependent() {
        fail("u1", AttemptLimiter.MAX_FAILURES);
        assertThrows(ApiException.class, () -> limiter.checkAllowed("u1"));

        assertDoesNotThrow(() -> limiter.checkAllowed("u2"));
    }
}
