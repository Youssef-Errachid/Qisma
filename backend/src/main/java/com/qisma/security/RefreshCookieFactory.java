package com.qisma.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class RefreshCookieFactory {

    public static final String COOKIE_NAME = "qisma_refresh";
    private static final String PATH = "/api/v1/auth";

    private final boolean secure;
    private final Duration maxAge;

    public RefreshCookieFactory(@Value("${qisma.refresh.cookie-secure}") boolean secure,
                                @Value("${qisma.refresh.ttl-days}") long ttlDays) {
        this.secure = secure;
        this.maxAge = Duration.ofDays(ttlDays);
    }

    public ResponseCookie issue(String token) {
        return base(token).maxAge(maxAge).build();
    }

    public ResponseCookie clear() {
        return base("").maxAge(Duration.ZERO).build();
    }

    private ResponseCookie.ResponseCookieBuilder base(String value) {
        return ResponseCookie.from(COOKIE_NAME, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Strict")
                .path(PATH);
    }
}
