package com.qisma.service.finance;

import java.util.List;

/** An ACTIVE expense as seen by the ledger. Shares must sum exactly to the amount. */
public record LedgerExpense(String paidBy, long amountMinor, List<ShareAllocation> shares) {

    public LedgerExpense {
        if (paidBy == null || paidBy.isBlank()) {
            throw new IllegalArgumentException("paidBy must not be blank");
        }
        if (amountMinor <= 0L) {
            throw new IllegalArgumentException("Expense amount must be positive");
        }
        if (shares == null || shares.isEmpty()) {
            throw new LedgerInvariantViolation("Expense has no shares");
        }
        long sum = 0L;
        for (ShareAllocation share : shares) {
            sum = Math.addExact(sum, share.shareMinor());
        }
        if (sum != amountMinor) {
            throw new LedgerInvariantViolation(
                    "Expense shares sum to " + sum + " but amount is " + amountMinor);
        }
        shares = List.copyOf(shares);
    }
}
