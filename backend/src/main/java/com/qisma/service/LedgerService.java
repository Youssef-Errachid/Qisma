package com.qisma.service;

public interface LedgerService {

    /** Reads the group's ACTIVE expenses and its CONFIRMED and PENDING settlements and computes the ledger. */
    GroupLedger load(String groupId);
}
