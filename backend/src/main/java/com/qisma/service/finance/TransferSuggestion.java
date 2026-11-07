package com.qisma.service.finance;

/** A suggested transfer of money from a debtor to a creditor. */
public record TransferSuggestion(String fromUserId, String toUserId, long amountMinor) {

    public TransferSuggestion {
        if (fromUserId == null || toUserId == null || fromUserId.equals(toUserId)) {
            throw new IllegalArgumentException("Invalid transfer parties");
        }
        if (amountMinor <= 0L) {
            throw new IllegalArgumentException("Transfer amount must be positive");
        }
    }
}
