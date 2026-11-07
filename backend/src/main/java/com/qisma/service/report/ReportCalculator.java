package com.qisma.service.report;

import java.math.BigInteger;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Pure statistics over a list of expenses. All amounts are whole minor units and every sum is overflow-checked. */
public final class ReportCalculator {

    private ReportCalculator() {
    }

    /** One point per month from..to inclusive, months without expenses included with zeros (ready to chart). */
    public static List<MonthPoint> monthly(List<ReportExpense> expenses, YearMonth from, YearMonth to) {
        Map<YearMonth, long[]> months = new TreeMap<>();
        for (YearMonth m = from; !m.isAfter(to); m = m.plusMonths(1)) {
            months.put(m, new long[]{0L, 0L});
        }
        for (ReportExpense e : expenses) {
            long[] bucket = months.get(YearMonth.from(e.date()));
            if (bucket != null) {
                bucket[0] = Math.addExact(bucket[0], e.amountMinor());
                bucket[1]++;
            }
        }
        List<MonthPoint> points = new ArrayList<>();
        months.forEach((month, b) -> points.add(new MonthPoint(month, b[0], (int) b[1])));
        return points;
    }

    /** Categories that have expenses, biggest first (ties by name so the order is stable). */
    public static List<CategoryPoint> byCategory(List<ReportExpense> expenses) {
        Map<String, long[]> totals = new LinkedHashMap<>();
        long grand = 0L;
        for (ReportExpense e : expenses) {
            long[] bucket = totals.computeIfAbsent(e.category(), k -> new long[]{0L, 0L});
            bucket[0] = Math.addExact(bucket[0], e.amountMinor());
            bucket[1]++;
            grand = Math.addExact(grand, e.amountMinor());
        }
        final long total = grand;
        List<CategoryPoint> points = new ArrayList<>();
        totals.forEach((category, b) -> points.add(new CategoryPoint(category, b[0], (int) b[1], shareBp(b[0], total))));
        points.sort(Comparator.comparingLong(CategoryPoint::totalMinor).reversed()
                .thenComparing(CategoryPoint::category));
        return points;
    }

    public static long total(List<ReportExpense> expenses) {
        long total = 0L;
        for (ReportExpense e : expenses) {
            total = Math.addExact(total, e.amountMinor());
        }
        return total;
    }

    /**
     * What each member paid and what each member's share was. Members come first in the given order (even with
     * zeros); anyone else who appears in an expense is appended, so the sums always equal the expenses' sums.
     */
    public static List<ContributionPoint> contributions(List<ReportExpense> expenses, Collection<String> memberIds) {
        Map<String, long[]> byUser = new LinkedHashMap<>();
        memberIds.forEach(id -> byUser.put(id, new long[]{0L, 0L}));
        for (ReportExpense e : expenses) {
            long[] payer = byUser.computeIfAbsent(e.paidBy(), k -> new long[]{0L, 0L});
            payer[0] = Math.addExact(payer[0], e.amountMinor());
            e.sharesByUser().forEach((userId, share) -> {
                long[] bucket = byUser.computeIfAbsent(userId, k -> new long[]{0L, 0L});
                bucket[1] = Math.addExact(bucket[1], share);
            });
        }
        List<ContributionPoint> points = new ArrayList<>();
        byUser.forEach((userId, b) -> points.add(new ContributionPoint(userId, b[0], b[1])));
        return points;
    }

    static int shareBp(long part, long total) {
        if (total <= 0L) {
            return 0;
        }
        BigInteger scaled = BigInteger.valueOf(part).multiply(BigInteger.valueOf(10_000L))
                .add(BigInteger.valueOf(total / 2L));
        return scaled.divide(BigInteger.valueOf(total)).intValue();
    }
}
