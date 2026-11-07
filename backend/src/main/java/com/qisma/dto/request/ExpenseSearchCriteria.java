package com.qisma.dto.request;

import com.qisma.enums.ExpenseCategory;

import java.time.LocalDate;

/** Optional filters for the expense list. from/to are inclusive and apply to expenseDate. */
public record ExpenseSearchCriteria(
        LocalDate from,
        LocalDate to,
        ExpenseCategory category,
        String paidBy,
        String participant,
        String q
) {
}
