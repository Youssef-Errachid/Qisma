package com.qisma.security;

import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Temporary in-memory brake against guessing invitation codes: 10 failures per user per 10 minutes.
 * It does not survive a restart and is not shared between servers (to be replaced by a real rate limiter).
 */
@Component
public class AttemptLimiter {

    public static final int MAX_FAILURES = 10;
    public static final Duration WINDOW = Duration.ofMinutes(10);

    private final Clock clock;
    private final ConcurrentHashMap<String, Deque<Instant>> failures = new ConcurrentHashMap<>();

    public AttemptLimiter(Clock clock) {
        this.clock = clock;
    }

    public void checkAllowed(String key) {
        Deque<Instant> deque = failures.get(key);
        if (deque == null) {
            return;
        }
        synchronized (deque) {
            prune(deque);
            if (deque.size() >= MAX_FAILURES) {
                throw new ApiException(ErrorCode.TOO_MANY_ATTEMPTS, "Too many attempts, try again later");
            }
        }
    }

    public void recordFailure(String key) {
        Deque<Instant> deque = failures.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (deque) {
            prune(deque);
            deque.addLast(clock.instant());
        }
    }

    private void prune(Deque<Instant> deque) {
        Instant limit = clock.instant().minus(WINDOW);
        while (!deque.isEmpty() && deque.peekFirst().isBefore(limit)) {
            deque.pollFirst();
        }
    }
}
