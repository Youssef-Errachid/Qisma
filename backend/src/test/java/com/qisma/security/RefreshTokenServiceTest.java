package com.qisma.security;

import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.model.RefreshToken;
import com.qisma.repository.RefreshTokenStore;
import com.qisma.util.TokenUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class RefreshTokenServiceTest {

    static class TestClock extends Clock {
        Instant now = Instant.parse("2026-11-07T12:00:00Z");

        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }

    }

    static class InMemoryStore implements RefreshTokenStore {
        final List<RefreshToken> tokens = new ArrayList<>();

        @Override
        public RefreshToken save(RefreshToken token) {
            tokens.add(token);
            return token;
        }

        @Override
        public Optional<RefreshToken> claimActive(String tokenHash, Instant now) {
            for (RefreshToken t : tokens) {
                if (t.getTokenHash().equals(tokenHash) && t.getRevokedAt() == null && t.getExpiresAt().isAfter(now)) {
                    t.setRevokedAt(now);
                    return Optional.of(t);
                }
            }
            return Optional.empty();
        }

        @Override
        public Optional<RefreshToken> findByHash(String tokenHash) {
            return tokens.stream().filter(t -> t.getTokenHash().equals(tokenHash)).findFirst();
        }

        @Override
        public void revokeAllForUser(String userId, Instant now) {
            tokens.stream()
                    .filter(t -> t.getUserId().equals(userId) && t.getRevokedAt() == null)
                    .forEach(t -> t.setRevokedAt(now));
        }

        @Override
        public void revokeFamily(String familyId, Instant now) {
            tokens.stream()
                    .filter(t -> t.getFamilyId().equals(familyId) && t.getRevokedAt() == null)
                    .forEach(t -> t.setRevokedAt(now));

        }
    }

    private TestClock clock;
    private InMemoryStore store;
    private RefreshTokenService service;

    @BeforeEach
    void setUp() {
        clock = new TestClock();
        store = new InMemoryStore();
        service = new RefreshTokenService(store, clock, 14);
    }

    private void assertRejected(String token) {
        ApiException e = assertThrows(ApiException.class, () -> service.rotate(token));
        assertEquals(ErrorCode.INVALID_REFRESH_TOKEN, e.getCode());
    }

    @Test
    void issue_storesOnlyTheHash() {
        String raw = service.issue("u1");

        assertEquals(1, store.tokens.size());
        RefreshToken stored = store.tokens.get(0);
        assertNotEquals(raw, stored.getTokenHash());
        assertEquals(TokenUtil.sha256Hex(raw), stored.getTokenHash());
        assertEquals(clock.now.plus(Duration.ofDays(14)), stored.getExpiresAt());
    }

    @Test
    void rotate_returnsNewTokenInSameFamily_andRevokesTheOldOne() {

        String first = service.issue("u1");
        RefreshTokenService.Rotated rotated = service.rotate(first);

        assertEquals("u1", rotated.userId());
        assertNotEquals(first, rotated.refreshToken());
        assertEquals(2, store.tokens.size());
        assertEquals(store.tokens.get(0).getFamilyId(), store.tokens.get(1).getFamilyId());
        assertNotNull(store.tokens.get(0).getRevokedAt());
        assertNull(store.tokens.get(1).getRevokedAt());
    }

    @Test
    void reusingAnOldToken_revokesTheWholeFamily() {
        String first = service.issue("u1");
        String second = service.rotate(first).refreshToken();

        assertRejected(first);          // replay of a consumed token
        assertRejected(second);         // the legitimate holder is cut off as well
    }

    @Test
    void expiredToken_isRejected() {
        String raw = service.issue("u1");
        clock.now = clock.now.plus(Duration.ofDays(15));
        assertRejected(raw);
    }

    @Test
    void unknownOrBlankToken_isRejected() {
        assertRejected("not-a-real-token");
        assertRejected("");
        assertRejected(null);

    }

    @Test
    void revoke_endsTheWholeSession() {
        String first = service.issue("u1");
        String second = service.rotate(first).refreshToken();

        service.revoke(second);

        assertRejected(second);
    }

    @Test
    void revoke_unknownOrNullToken_isIgnored() {
        assertDoesNotThrow(() -> service.revoke("unknown"));
        assertDoesNotThrow(() -> service.revoke(null));
    }

    @Test
    void separateLogins_haveIndependentSessions() {
        String phone = service.issue("u1");
        String laptop = service.issue("u1");

        service.revoke(phone);

        assertRejected(phone);
        assertDoesNotThrow(() -> service.rotate(laptop));
    }
}
