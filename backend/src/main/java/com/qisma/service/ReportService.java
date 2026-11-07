package com.qisma.service;

import com.qisma.dto.response.CategoryReportResponse;
import com.qisma.dto.response.ContributionsResponse;
import com.qisma.dto.response.MonthlyReportResponse;
import com.qisma.dto.response.ReportSummaryResponse;

import java.time.LocalDate;

/** Read-only statistics for the dashboard. Any member of the group may read them. */
public interface ReportService {

    ReportSummaryResponse summary(String userId, String groupId);

    /** from and to are yyyy-MM and optional: the default is the 12 months ending with the current month. */
    MonthlyReportResponse monthly(String userId, String groupId, String from, String to);

    /** Totals per category over a period (whole days, both inclusive, both optional). */
    CategoryReportResponse categories(String userId, String groupId, LocalDate from, LocalDate to);

    /** What every member paid and their share of the expenses of a period (whole days, optional). */
    ContributionsResponse contributions(String userId, String groupId, LocalDate from, LocalDate to);
}
