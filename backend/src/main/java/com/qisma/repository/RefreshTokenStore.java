package com.qisma.repository;

import com.qisma.model.RefreshToken;

import java.time.Instant;
import java.util.Optional;

public interface RefreshTokenStore {

    RefreshToken save(RefreshToken token);

    /**
     * Atomically revokes the token if it is still active (not revoked, not expired)
     * and returns it. Returns empty if there was nothing to claim.
     */
    Optional<RefreshToken> claimActive(String tokenHash, Instant now);

    Optional<RefreshToken> findByHash(String tokenHash);

    /** Revokes every still-active token of the family. */
    void revokeFamily(String familyId, Instant now);
}
