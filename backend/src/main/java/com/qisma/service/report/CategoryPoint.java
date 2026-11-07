package com.qisma.service.report;

/** shareBp is the share of the total in basis points (10000 = 100%), rounded: for display only. */
public record CategoryPoint(String category, long totalMinor, int count, int shareBp) {
}
