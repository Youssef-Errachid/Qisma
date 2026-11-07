package com.qisma.dto.response;

/** Financial overview of a group, in minor units. outstandingDebtsMinor is what is still owed after settlements. */
public record ReportSummaryResponse(
        String currency,
        long totalExpensesMinor,
        long expenseCount,
        int memberCount,
        int activeMemberCount,
        long outstandingDebtsMinor,
        long confirmedSettlementsMinor,
        long pendingSettlementsMinor,
        int pendingSettlementsCount
) {
}
