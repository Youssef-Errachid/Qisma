package com.qisma.service.report;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;

class ReportCalculatorTest {

    private static ReportExpense expense(String date, String category, long amount, String paidBy, Map<String, Long> shares) {
        return new ReportExpense(LocalDate.parse(date), category, amount, paidBy, shares);
    }

    private static ReportExpense simple(String date, String category, long amount) {
        return expense(date, category, amount, "a", Map.of("a", amount));
    }

    // ---------------- monthly ----------------

    @Test
    void monthly_hasOnePointPerMonth_includingEmptyOnes_inOrder() {
        List<MonthPoint> points = ReportCalculator.monthly(List.of(simple("2026-10-05", "FOOD", 1000)),
                YearMonth.of(2026, 9), YearMonth.of(2026, 11));

        assertEquals(List.of(YearMonth.of(2026, 9), YearMonth.of(2026, 10), YearMonth.of(2026, 11)),
                points.stream().map(MonthPoint::month).toList());
        assertEquals(List.of(0L, 1000L, 0L), points.stream().map(MonthPoint::totalMinor).toList());
        assertEquals(List.of(0, 1, 0), points.stream().map(MonthPoint::count).toList());
    }

    @Test
    void monthly_putsTheLastAndFirstDayOfAMonthInTheRightBucket() {
        List<MonthPoint> points = ReportCalculator.monthly(List.of(
                simple("2026-01-31", "FOOD", 100), simple("2026-02-01", "FOOD", 200), simple("2026-02-28", "FOOD", 300)),
                YearMonth.of(2026, 1), YearMonth.of(2026, 2));

        assertEquals(100L, points.get(0).totalMinor());
        assertEquals(500L, points.get(1).totalMinor());
        assertEquals(2, points.get(1).count());
    }

    @Test
    void monthly_ignoresExpensesOutsideTheRange() {
        List<MonthPoint> points = ReportCalculator.monthly(List.of(
                simple("2025-12-31", "FOOD", 999), simple("2026-04-01", "FOOD", 999)),
                YearMonth.of(2026, 1), YearMonth.of(2026, 3));

        assertEquals(3, points.size());
        points.forEach(p -> assertEquals(0L, p.totalMinor()));
    }

    @Test
    void monthly_acrossAYearBoundary_isContinuous() {
        List<MonthPoint> points = ReportCalculator.monthly(List.of(), YearMonth.of(2025, 11), YearMonth.of(2026, 2));

        assertEquals(List.of("2025-11", "2025-12", "2026-01", "2026-02"),
                points.stream().map(p -> p.month().toString()).toList());
    }

    @Test
    void monthly_forASingleMonth_hasOnePoint() {
        assertEquals(1, ReportCalculator.monthly(List.of(), YearMonth.of(2026, 5), YearMonth.of(2026, 5)).size());
    }

    // ---------------- categories ----------------

    @Test
    void byCategory_sumsPerCategory_biggestFirst() {
        List<CategoryPoint> points = ReportCalculator.byCategory(List.of(
                simple("2026-10-01", "FOOD", 1000), simple("2026-10-02", "RENT", 5000),
                simple("2026-10-03", "FOOD", 500)));

        assertEquals(List.of("RENT", "FOOD"), points.stream().map(CategoryPoint::category).toList());
        assertEquals(5000L, points.get(0).totalMinor());
        assertEquals(1500L, points.get(1).totalMinor());
        assertEquals(2, points.get(1).count());
    }

    @Test
    void byCategory_ties_areOrderedByName_soTheOrderIsStable() {
        List<CategoryPoint> points = ReportCalculator.byCategory(List.of(
                simple("2026-10-01", "WATER", 100), simple("2026-10-02", "FOOD", 100), simple("2026-10-03", "RENT", 100)));

        assertEquals(List.of("FOOD", "RENT", "WATER"), points.stream().map(CategoryPoint::category).toList());
    }

    @Test
    void byCategory_percentagesAreInBasisPoints_andRounded() {
        List<CategoryPoint> points = ReportCalculator.byCategory(List.of(
                simple("2026-10-01", "FOOD", 100), simple("2026-10-02", "RENT", 100), simple("2026-10-03", "WATER", 100)));

        points.forEach(p -> assertEquals(3333, p.shareBp()));

        List<CategoryPoint> half = ReportCalculator.byCategory(List.of(
                simple("2026-10-01", "FOOD", 300), simple("2026-10-02", "RENT", 100)));
        assertEquals(7500, half.get(0).shareBp());
        assertEquals(2500, half.get(1).shareBp());
    }

    @Test
    void byCategory_aSingleCategory_is100Percent_andNoExpensesGivesNothing() {
        assertEquals(10000, ReportCalculator.byCategory(List.of(simple("2026-10-01", "FOOD", 7))).get(0).shareBp());
        assertTrue(ReportCalculator.byCategory(List.of()).isEmpty());
    }

    @Test
    void shareBp_neverDividesByZero_andSurvivesHugeAmounts() {
        assertEquals(0, ReportCalculator.shareBp(0, 0));
        assertEquals(5000, ReportCalculator.shareBp(500_000_000_000_000L, 1_000_000_000_000_000L));
    }

    @Test
    void total_addsEverything() {
        assertEquals(0L, ReportCalculator.total(List.of()));
        assertEquals(1500L, ReportCalculator.total(List.of(simple("2026-10-01", "FOOD", 1000), simple("2026-10-02", "FOOD", 500))));
    }

    // ---------------- contributions ----------------

    @Test
    void contributions_separatePaidFromShare() {
        List<ContributionPoint> points = ReportCalculator.contributions(List.of(
                expense("2026-10-01", "FOOD", 300, "youssef", Map.of("youssef", 100L, "ahmed", 100L, "hamza", 100L))),
                List.of("youssef", "ahmed", "hamza"));

        assertEquals(new ContributionPoint("youssef", 300, 100), points.get(0));
        assertEquals(new ContributionPoint("ahmed", 0, 100), points.get(1));
        assertEquals(new ContributionPoint("hamza", 0, 100), points.get(2));
    }

    @Test
    void contributions_aPayerWhoTakesNoPart_paysWithoutAShare() {
        List<ContributionPoint> points = ReportCalculator.contributions(List.of(
                expense("2026-10-01", "FOOD", 200, "youssef", Map.of("ahmed", 100L, "hamza", 100L))),
                List.of("youssef", "ahmed", "hamza"));

        assertEquals(new ContributionPoint("youssef", 200, 0), points.get(0));
    }

    @Test
    void contributions_membersWithoutExpensesStillAppear_withZeros_inTheGivenOrder() {
        List<ContributionPoint> points = ReportCalculator.contributions(List.of(), List.of("a", "b", "c"));

        assertEquals(List.of("a", "b", "c"), points.stream().map(ContributionPoint::userId).toList());
        points.forEach(p -> assertEquals(0L, p.paidMinor() + p.shareMinor()));
    }

    @Test
    void contributions_aNonMemberInAnExpense_isAppended_soTheSumsStayHonest() {
        List<ContributionPoint> points = ReportCalculator.contributions(List.of(
                expense("2026-10-01", "FOOD", 100, "ghost", Map.of("ghost", 100L))), List.of("a"));

        assertEquals(List.of("a", "ghost"), points.stream().map(ContributionPoint::userId).toList());
        assertEquals(100L, points.stream().mapToLong(ContributionPoint::paidMinor).sum());
    }

    @Test
    void property_totalPaid_totalShare_andTheMonthlyAndCategoryTotals_alwaysAgree() {
        Random random = new Random(21);
        List<String> ids = List.of("a", "b", "c");
        String[] categories = {"FOOD", "RENT", "WATER", "OTHER"};

        for (int round = 0; round < 500; round++) {
            List<ReportExpense> expenses = new ArrayList<>();
            for (int i = random.nextInt(25); i > 0; i--) {
                long amount = 1 + random.nextInt(100_000);
                long first = amount / 2;
                expenses.add(expense("2026-" + String.format("%02d", 1 + random.nextInt(12)) + "-15",
                        categories[random.nextInt(categories.length)], amount, ids.get(random.nextInt(3)),
                        Map.of("a", first, "b", amount - first)));
            }
            long total = ReportCalculator.total(expenses);

            List<ContributionPoint> contributions = ReportCalculator.contributions(expenses, ids);
            assertEquals(total, contributions.stream().mapToLong(ContributionPoint::paidMinor).sum(), "paid, round " + round);
            assertEquals(total, contributions.stream().mapToLong(ContributionPoint::shareMinor).sum(), "share, round " + round);
            assertEquals(total, ReportCalculator.byCategory(expenses).stream().mapToLong(CategoryPoint::totalMinor).sum(),
                    "categories, round " + round);
            assertEquals(total, ReportCalculator.monthly(expenses, YearMonth.of(2026, 1), YearMonth.of(2026, 12))
                    .stream().mapToLong(MonthPoint::totalMinor).sum(), "months, round " + round);
        }
    }
}
