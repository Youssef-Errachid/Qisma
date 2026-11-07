package com.qisma.repository;

import com.qisma.model.Invitation;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface InvitationStore {

    Invitation save(Invitation invitation);

    Optional<Invitation> findById(String id);

    Optional<Invitation> findBySecretHash(String secretHash);

    List<Invitation> findByGroupId(String groupId);

    /**
     * Atomically takes one use of a still-valid invitation (PENDING, not expired, uses left)
     * and returns it. Marks it ACCEPTED when the last use is taken. Empty if it cannot be claimed.
     */
    Optional<Invitation> claimUse(String secretHash, String userId, Instant now);

    /** Gives a use back, when the membership could not be created after the claim. */
    void releaseUse(String invitationId, String userId);

    /** Revokes the invitation if it is still PENDING. Returns false if nothing changed. */
    boolean revokePending(String invitationId, String groupId, Instant now);
}
