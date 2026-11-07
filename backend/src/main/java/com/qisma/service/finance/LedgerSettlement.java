package com.qisma.service.finance;

/** A CONFIRMED settlement: money really moved from one member to another. */
public record LedgerSettlement(String fromUserId, String toUserId, long amountMinor) {

    public LedgerSettlement {
        if (fromUserId == null || fromUserId.isBlank() || toUserId == null || toUserId.isBlank()) {
            throw new IllegalArgumentException("Settlement users must not be blank");
        }
        if (fromUserId.equals(toUserId)) {
            throw new IllegalArgumentException("Settlement sender and receiver must differ");
        }
        if (amountMinor <= 0L) {
            throw new IllegalArgumentException("Settlement amount must be positive");
        }
    }
}
