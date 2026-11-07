package com.qisma.service.report;

import java.time.YearMonth;

public record MonthPoint(YearMonth month, long totalMinor, int count) {
}
