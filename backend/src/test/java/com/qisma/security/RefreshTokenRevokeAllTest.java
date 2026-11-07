package com.qisma.security;

import com.qisma.exception.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class RefreshTokenRevokeAllTest {

    private RefreshTokenService service;

    @BeforeEach
    void setUp() {
        service = new RefreshTokenService(new RefreshTokenServiceTest.InMemoryStore(),
                new RefreshTokenServiceTest.TestClock(), 14);
    }

    @Test
    void revokeAllForUser_endsEverySessionOfThatUser_butNotOthers() {
        String phone = service.issue("u1");
        String laptop = service.issue("u1");
        String other = service.issue("u2");

        service.revokeAllForUser("u1");

        assertThrows(ApiException.class, () -> service.rotate(phone));
        assertThrows(ApiException.class, () -> service.rotate(laptop));
        assertDoesNotThrow(() -> service.rotate(other));

    }

    @Test
    void revokeAllForUser_withNoSessions_isANoOp() {
        assertDoesNotThrow(() -> service.revokeAllForUser("nobody"));
    }
}
