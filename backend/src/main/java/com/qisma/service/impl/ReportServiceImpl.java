package com.qisma.service.impl;

import com.qisma.dto.response.CategoryReportResponse;
import com.qisma.dto.response.ContributionsResponse;
import com.qisma.dto.response.MonthlyReportResponse;
import com.qisma.dto.response.ReportSummaryResponse;
import com.qisma.enums.ExpenseStatus;
import com.qisma.enums.MembershipStatus;
import com.qisma.enums.SettlementStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.model.Expense;
import com.qisma.model.Membership;
import com.qisma.model.User;
import com.qisma.repository.ExpenseRepository;
import com.qisma.repository.SettlementRepository;
import com.qisma.repository.UserRepository;
import com.qisma.security.GroupAccessGuard;
import com.qisma.service.GroupLedger;
import com.qisma.service.LedgerService;
import com.qisma.service.ReportService;
import com.qisma.service.finance.MemberBalance;
import com.qisma.service.report.CategoryPoint;
import com.qisma.service.report.ContributionPoint;
import com.qisma.service.report.MonthPoint;
import com.qisma.service.report.ReportCalculator;
import com.qisma.service.report.ReportExpense;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Statistics are computed from the ACTIVE expenses and the confirmed settlements, the same data the balances use.
 * Nothing here is stored: it is always recalculated, so it can never disagree with the ledger.
 */
@Service
public class ReportServiceImpl implements ReportService {

    static final int DEFAULT_MONTHS = 12;
    static final int MAX_MONTHS = 60;
    static final String UNKNOWN_USER = "Unknown user";

    private final GroupAccessGuard guard;
    private final LedgerService ledgerService;
    private final ExpenseRepository expenses;
    private final SettlementRepository settlements;
    private final UserRepository users;
    private final Clock clock;

    public ReportServiceImpl(GroupAccessGuard guard, LedgerService ledgerService, ExpenseRepository expenses,
                             SettlementRepository settlements, UserRepository users, Clock clock) {
        this.guard = guard;
        this.ledgerService = ledgerService;
        this.expenses = expenses;
        this.settlements = settlements;
        this.users = users;
        this.clock = clock;
    }

    @Override
    public ReportSummaryResponse summary(String userId, String groupId) {
        String currency = guard.forRead(groupId, userId).group().getCurrency();
        GroupLedger ledger = ledgerService.load(groupId);

        long totalExpenses = 0L;
        long confirmedSettlements = 0L;
        long outstandingDebts = 0L;
        int active = 0;
        for (Membership m : ledger.members()) {
            MemberBalance b = ledger.balances().get(m.getUserId());
            totalExpenses = Math.addExact(totalExpenses, b.paidMinor());
            confirmedSettlements = Math.addExact(confirmedSettlements, b.sentMinor());
            if (b.netMinor() > 0L) {
                // what the creditors are still owed equals what the debtors still owe
                outstandingDebts = Math.addExact(outstandingDebts, b.netMinor());
            }
            if (m.getStatus() == MembershipStatus.ACTIVE) {
                active++;
            }
        }
        long pendingAmount = 0L;
        for (long amount : ledger.pendingOut().values()) {
            pendingAmount = Math.addExact(pendingAmount, amount);
        }

        return new ReportSummaryResponse(currency, totalExpenses,
                expenses.countByGroupIdAndStatus(groupId, ExpenseStatus.ACTIVE),
                ledger.members().size(), active, outstandingDebts, confirmedSettlements, pendingAmount,
                settlements.findByGroupIdAndStatus(groupId, SettlementStatus.PENDING).size());
    }

    @Override
    public MonthlyReportResponse monthly(String userId, String groupId, String from, String to) {
        String currency = guard.forRead(groupId, userId).group().getCurrency();

        YearMonth current = YearMonth.now(clock.withZone(ZoneOffset.UTC));
        YearMonth end = (to == null || to.isBlank()) ? current : parseMonth(to, "to");
        YearMonth start = (from == null || from.isBlank()) ? end.minusMonths(DEFAULT_MONTHS - 1L) : parseMonth(from, "from");
        if (start.isAfter(end)) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "'from' must not be after 'to'");
        }
        if (ChronoUnit.MONTHS.between(start, end) + 1 > MAX_MONTHS) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "A monthly report covers at most " + MAX_MONTHS + " months");
        }

        List<MonthPoint> points = ReportCalculator.monthly(activeExpenses(groupId, null, null), start, end);
        return new MonthlyReportResponse(currency, start.toString(), end.toString(), points.stream()
                .map(p -> new MonthlyReportResponse.MonthlyPoint(p.month().toString(), p.totalMinor(), p.count()))
                .toList());
    }

    @Override
    public CategoryReportResponse categories(String userId, String groupId, LocalDate from, LocalDate to) {
        String currency = guard.forRead(groupId, userId).group().getCurrency();
        requireOrderedPeriod(from, to);

        List<ReportExpense> inPeriod = activeExpenses(groupId, from, to);
        List<CategoryPoint> points = ReportCalculator.byCategory(inPeriod);
        return new CategoryReportResponse(currency, from, to, ReportCalculator.total(inPeriod), points.stream()
                .map(p -> new CategoryReportResponse.CategoryItem(p.category(), p.totalMinor(), p.count(), p.shareBp()))
                .toList());
    }

    @Override
    public ContributionsResponse contributions(String userId, String groupId, LocalDate from, LocalDate to) {
        String currency = guard.forRead(groupId, userId).group().getCurrency();
        requireOrderedPeriod(from, to);

        GroupLedger ledger = ledgerService.load(groupId);
        List<ContributionPoint> points = ReportCalculator.contributions(activeExpenses(groupId, from, to),
                ledger.members().stream().map(Membership::getUserId).toList());

        Map<String, User> usersById = users.findAllById(points.stream().map(ContributionPoint::userId).toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity(), (a, b) -> a));
        return new ContributionsResponse(currency, from, to, points.stream().map(p -> {
            User user = usersById.get(p.userId());
            return new ContributionsResponse.MemberContribution(p.userId(),
                    user != null ? user.getUsername() : UNKNOWN_USER,
                    user != null ? user.getFullName() : UNKNOWN_USER,
                    p.paidMinor(), p.shareMinor());
        }).toList());
    }

    // ---------------- helpers ----------------

    private List<ReportExpense> activeExpenses(String groupId, LocalDate from, LocalDate to) {
        return expenses.findByGroupIdAndStatus(groupId, ExpenseStatus.ACTIVE).stream()
                .filter(e -> e.getExpenseDate() != null)
                .filter(e -> from == null || !e.getExpenseDate().isBefore(from))
                .filter(e -> to == null || !e.getExpenseDate().isAfter(to))
                .map(ReportServiceImpl::toReportExpense)
                .toList();
    }

    private static ReportExpense toReportExpense(Expense e) {
        Map<String, Long> shares = new LinkedHashMap<>();
        e.getShares().forEach(s -> shares.merge(s.userId(), s.shareMinor(), Math::addExact));
        return new ReportExpense(e.getExpenseDate(), e.getCategory() == null ? "OTHER" : e.getCategory().name(),
                e.getAmountMinor(), e.getPaidBy(), new HashMap<>(shares));
    }

    private static void requireOrderedPeriod(LocalDate from, LocalDate to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "'from' must not be after 'to'");
        }
    }

    private static YearMonth parseMonth(String value, String name) {
        try {
            return YearMonth.parse(value.trim());
        } catch (DateTimeParseException e) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "'" + name + "' must look like 2026-11");
        }
    }
}
