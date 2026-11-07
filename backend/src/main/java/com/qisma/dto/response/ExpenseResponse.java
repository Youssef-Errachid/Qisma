package com.qisma.dto.response;

import com.qisma.enums.ExpenseCategory;
import com.qisma.enums.ExpenseStatus;
import com.qisma.enums.SplitMethod;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record ExpenseResponse(
        String id,
        String groupId,
        String title,
        String description,
        long amountMinor,
        String currency,
        String paidBy,
        ExpenseCategory category,
        SplitMethod splitMethod,
        List<ExpenseShareResponse> shares,
        LocalDate expenseDate,
        ExpenseStatus status,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Long version
) {
}
