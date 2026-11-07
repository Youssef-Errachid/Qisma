package com.qisma.repository;

import com.qisma.model.Settlement;

import java.time.Instant;
import java.util.Optional;

/**
 * Every transition is ONE conditional update: it only applies if the settlement is still PENDING and the
 * right member is acting. If two requests race, exactly one of them gets the document back; the other gets
 * empty. That is what makes a double confirmation impossible.
 */
public interface SettlementTransitionStore {

    Optional<Settlement> markConfirmed(String settlementId, String groupId, String receiverId, Instant now);

    Optional<Settlement> markRejected(String settlementId, String groupId, String receiverId, String reason, Instant now);

    Optional<Settlement> markCancelled(String settlementId, String groupId, String senderId, Instant now);
}
