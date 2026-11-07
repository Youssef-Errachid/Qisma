package com.qisma.repository;

import java.time.Instant;

/**
 * Partial updates of a group. The whole document is NEVER saved from an entity read earlier: ledgerVersion is
 * a counter that every financial operation increments, and saving a stale copy would write the old value back.
 */
public interface GroupUpdateStore {

    void updateDetails(String groupId, String name, String description);

    /**
     * Changes the currency only if the group never had a financial operation (ledgerVersion is still 0). It is
     * one conditional update, so it cannot race with the first expense: returns false when nothing changed.
     */
    boolean changeCurrency(String groupId, String currency);

    void setOwner(String groupId, String ownerId);

    /** Archives the group if it is still ACTIVE. Returns false when nothing changed. */
    boolean archive(String groupId, Instant now);
}
