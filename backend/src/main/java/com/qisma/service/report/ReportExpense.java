package com.qisma.service.report;

import java.time.LocalDate;
import java.util.Map;

/** What the reports need from an expense, with no database types: shares are userId to minor units. */
public record ReportExpense(LocalDate date, String category, long amountMinor, String paidBy,
                            Map<String, Long> sharesByUser) {
}
