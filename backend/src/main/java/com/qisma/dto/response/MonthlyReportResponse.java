package com.qisma.dto.response;

import java.util.List;

public record MonthlyReportResponse(String currency, String from, String to, List<MonthlyPoint> months) {

    /** month is yyyy-MM. */
    public record MonthlyPoint(String month, long totalMinor, int count) {
    }
}
