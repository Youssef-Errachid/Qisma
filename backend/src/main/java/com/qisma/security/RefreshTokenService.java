package com.qisma.security;

import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.model.RefreshToken;
import com.qisma.repository.RefreshTokenStore;
import com.qisma.util.TokenUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
public class RefreshTokenService {

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);

    public record Rotated(String userId, String familyId, String refreshToken) {
    }

    private final RefreshTokenStore store;
    private final Clock clock;
    private final Duration ttl;

    public RefreshTokenService(RefreshTokenStore store, Clock clock,
                               @Value("${qisma.refresh.ttl-days}") long ttlDays) {
        this.store = store;
        this.clock = clock;
        this.ttl = Duration.ofDays(ttlDays);
    }

    /** Starts a new session (new family) and returns the raw token to give to the client. */
    public String issue(String userId) {
        return create(userId, UUID.randomUUID().toString());
    }

    /** Consumes a token and returns a fresh one in the same family. */
    public Rotated rotate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw invalid();
        }
        String hash = TokenUtil.sha256Hex(rawToken);
        Instant now = clock.instant();

        Optional<RefreshToken> claimed = store.claimActive(hash, now);
        if (claimed.isPresent()) {
            RefreshToken old = claimed.get();
            String next = create(old.getUserId(), old.getFamilyId());
            return new Rotated(old.getUserId(), old.getFamilyId(), next);
        }

        // Not claimable: if it was already revoked, somebody is replaying an old token.
        store.findByHash(hash)
                .filter(t -> t.getRevokedAt() != null)
                .ifPresent(t -> {
                    log.warn("Refresh token reuse detected, revoking family {}", t.getFamilyId());
                    store.revokeFamily(t.getFamilyId(), now);
                });
        throw invalid();
    }

    public void revokeFamily(String familyId) {
        store.revokeFamily(familyId, clock.instant());
    }

    /** Logout: revokes the whole session. Unknown tokens are ignored. */
    public void revoke(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        store.findByHash(TokenUtil.sha256Hex(rawToken))
                .ifPresent(t -> store.revokeFamily(t.getFamilyId(), clock.instant()));
    }

    private String create(String userId, String familyId) {
        String raw = TokenUtil.randomToken();
        Instant now = clock.instant();
        store.save(new RefreshToken(userId, TokenUtil.sha256Hex(raw), familyId, now, now.plus(ttl)));
        return raw;
    }

    private static ApiException invalid() {
        return new ApiException(ErrorCode.INVALID_REFRESH_TOKEN, "Invalid or expired refresh token");
    }
}
