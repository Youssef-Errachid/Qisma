package com.qisma.dto.response;

import java.time.LocalDate;
import java.util.List;

public record CategoryReportResponse(String currency, LocalDate from, LocalDate to, long totalMinor,
                                     List<CategoryItem> categories) {

    /** shareBp: share of the total in basis points (10000 = 100%), rounded, for display only. */
    public record CategoryItem(String category, long totalMinor, int count, int shareBp) {
    }
}
