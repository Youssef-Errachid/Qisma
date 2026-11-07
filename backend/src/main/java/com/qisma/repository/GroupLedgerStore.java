package com.qisma.repository;

public interface GroupLedgerStore {

    /**
     * Increments the group's ledgerVersion and returns the new value. Called inside the transaction of
     * every financial operation: two concurrent operations on the same group conflict on this document,
     * so one of them is rejected instead of both slipping past a check.
     */
    long advance(String groupId);
}
