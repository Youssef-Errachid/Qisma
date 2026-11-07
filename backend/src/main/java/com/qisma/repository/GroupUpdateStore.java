package com.qisma.repository;

import java.time.Instant;

/**
 * Partial updates of a group. The whole document is NEVER saved from an entity read earlier: ledgerVersion is
 * a counter that every financial operation increments, and saving a stale copy would write the old value back.
 */
public interface GroupUpdateStore {

    /** currency is only written when it is not null. */
    void updateDetails(String groupId, String name, String description, String currency);

    void setOwner(String groupId, String ownerId);

    /** Archives the group if it is still ACTIVE. Returns false when nothing changed. */
    boolean archive(String groupId, Instant now);
}
