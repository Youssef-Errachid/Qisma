package com.qisma.service.finance;

/** The ledger is internally inconsistent. This is a bug or data corruption, never a client error. */
public class LedgerInvariantViolation extends IllegalStateException {
    public LedgerInvariantViolation(String message) {
        super(message);
    }
}
