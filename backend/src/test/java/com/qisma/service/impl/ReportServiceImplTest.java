package com.qisma.service.impl;

import com.qisma.dto.response.CategoryReportResponse;
import com.qisma.dto.response.ContributionsResponse;
import com.qisma.dto.response.MonthlyReportResponse;
import com.qisma.dto.response.ReportSummaryResponse;
import com.qisma.enums.ExpenseCategory;
import com.qisma.enums.ExpenseStatus;
import com.qisma.enums.GroupRole;
import com.qisma.enums.MembershipStatus;
import com.qisma.enums.SettlementStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.model.Expense;
import com.qisma.model.ExpenseShare;
import com.qisma.model.Group;
import com.qisma.model.Membership;
import com.qisma.model.Settlement;
import com.qisma.model.User;
import com.qisma.repository.ExpenseRepository;
import com.qisma.repository.SettlementRepository;
import com.qisma.repository.UserRepository;
import com.qisma.security.GroupAccessGuard;
import com.qisma.service.GroupLedger;
import com.qisma.service.LedgerService;
import com.qisma.service.finance.MemberBalance;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ReportServiceImplTest {

    private static final Instant NOW = Instant.parse("2026-11-07T12:00:00Z");

    private GroupAccessGuard guard;
    private LedgerService ledgerService;
    private ExpenseRepository expenses;
    private SettlementRepository settlements;
    private UserRepository users;
    private ReportServiceImpl service;

    @BeforeEach
    void setUp() {
        guard = mock(GroupAccessGuard.class);
        ledgerService = mock(LedgerService.class);
        expenses = mock(ExpenseRepository.class);
        settlements = mock(SettlementRepository.class);
        users = mock(UserRepository.class);
        service = new ReportServiceImpl(guard, ledgerService, expenses, settlements, users, Clock.fixed(NOW, ZoneOffset.UTC));

        Group group = new Group();
        group.setId("g1");
        group.setCurrency("MAD");
        when(guard.forRead("g1", "youssef")).thenReturn(new GroupAccessGuard.Access(group,
                new Membership("g1", "youssef", GroupRole.OWNER, NOW)));
        when(users.findAllById(any())).thenReturn(List.of(user("youssef"), user("ahmed"), user("hamza")));
        when(expenses.findByGroupIdAndStatus("g1", ExpenseStatus.ACTIVE)).thenReturn(List.of());
    }

    private static User user(String id) {
        User u = new User();
        u.setId(id);
        u.setUsername(id);
        u.setFullName(id.toUpperCase());
        return u;
    }

    private static Membership member(String id, MembershipStatus status) {
        Membership m = new Membership("g1", id, GroupRole.MEMBER, NOW);
        m.setStatus(status);
        return m;
    }

    private static Expense expense(String date, ExpenseCategory category, long amount, String paidBy, ExpenseShare... shares) {
        Expense e = new Expense();
        e.setExpenseDate(LocalDate.parse(date));
        e.setCategory(category);
        e.setAmountMinor(amount);
        e.setPaidBy(paidBy);
        e.setStatus(ExpenseStatus.ACTIVE);
        e.setShares(List.of(shares));
        return e;
    }

    private void ledgerOf(Map<String, MemberBalance> balances, Map<String, Long> pendingOut, List<Membership> members) {
        when(ledgerService.load("g1")).thenReturn(new GroupLedger(members, balances, pendingOut, Map.of()));
    }

    private static ErrorCode failure(Runnable action) {
        return assertThrows(ApiException.class, action::run).getCode();
    }

    // ---------------- summary ----------------

    @Test
    void summary_totalsComeFromTheLedger() {
        // youssef paid 300.00, ahmed paid 100.00; after a confirmed 40.00 from hamza to youssef
        Map<String, MemberBalance> balances = new HashMap<>();
        balances.put("youssef", new MemberBalance("youssef", 30000, 13333, 0, 4000));     // net +12667
        balances.put("ahmed", new MemberBalance("ahmed", 10000, 13333, 0, 0));            // net -3333
        balances.put("hamza", new MemberBalance("hamza", 0, 13334, 4000, 0));             // net -9334
        ledgerOf(balances, Map.of("ahmed", 1000L, "hamza", 500L), List.of(
                member("youssef", MembershipStatus.ACTIVE), member("ahmed", MembershipStatus.ACTIVE),
                member("hamza", MembershipStatus.INACTIVE)));
        when(expenses.countByGroupIdAndStatus("g1", ExpenseStatus.ACTIVE)).thenReturn(3L);
        when(settlements.findByGroupIdAndStatus("g1", SettlementStatus.PENDING))
                .thenReturn(List.of(new Settlement(), new Settlement()));

        ReportSummaryResponse r = service.summary("youssef", "g1");

        assertEquals("MAD", r.currency());
        assertEquals(40000L, r.totalExpensesMinor());
        assertEquals(3L, r.expenseCount());
        assertEquals(3, r.memberCount());
        assertEquals(2, r.activeMemberCount());
        assertEquals(12667L, r.outstandingDebtsMinor());
        assertEquals(4000L, r.confirmedSettlementsMinor());
        assertEquals(1500L, r.pendingSettlementsMinor());
        assertEquals(2, r.pendingSettlementsCount());
    }

    @Test
    void summary_outstandingDebts_equalWhatTheDebtorsOwe() {
        Map<String, MemberBalance> balances = new HashMap<>();
        balances.put("youssef", new MemberBalance("youssef", 30000, 10000, 0, 0));   // +20000
        balances.put("ahmed", new MemberBalance("ahmed", 0, 10000, 0, 0));           // -10000
        balances.put("hamza", new MemberBalance("hamza", 0, 10000, 0, 0));           // -10000
        ledgerOf(balances, Map.of(), List.of(member("youssef", MembershipStatus.ACTIVE),
                member("ahmed", MembershipStatus.ACTIVE), member("hamza", MembershipStatus.ACTIVE)));

        ReportSummaryResponse r = service.summary("youssef", "g1");

        long debtorsOwe = balances.values().stream().mapToLong(MemberBalance::netMinor).filter(n -> n < 0).map(n -> -n).sum();
        assertEquals(debtorsOwe, r.outstandingDebtsMinor());
    }

    @Test
    void summary_ofASettledGroup_hasNoOutstandingDebt() {
        Map<String, MemberBalance> balances = new HashMap<>();
        balances.put("youssef", new MemberBalance("youssef", 10000, 5000, 0, 5000));
        balances.put("ahmed", new MemberBalance("ahmed", 0, 5000, 5000, 0));
        ledgerOf(balances, Map.of(), List.of(member("youssef", MembershipStatus.ACTIVE), member("ahmed", MembershipStatus.ACTIVE)));

        assertEquals(0L, service.summary("youssef", "g1").outstandingDebtsMinor());
    }

    @Test
    void everyReport_byANonMember_isRefusedByTheGuard_andNothingIsRead() {
        when(guard.forRead("g1", "stranger")).thenThrow(new ApiException(ErrorCode.NOT_FOUND, "Group not found"));

        assertThrows(ApiException.class, () -> service.summary("stranger", "g1"));
        assertThrows(ApiException.class, () -> service.monthly("stranger", "g1", null, null));
        assertThrows(ApiException.class, () -> service.categories("stranger", "g1", null, null));
        assertThrows(ApiException.class, () -> service.contributions("stranger", "g1", null, null));
        verifyNoInteractions(ledgerService, expenses, settlements);
    }

    // ---------------- monthly ----------------

    @Test
    void monthly_defaultsToTheTwelveMonthsEndingWithTheCurrentOne() {
        MonthlyReportResponse r = service.monthly("youssef", "g1", null, null);

        assertEquals(12, r.months().size());
        assertEquals("2025-12", r.months().get(0).month());
        assertEquals("2026-11", r.months().get(11).month());
        assertEquals("2025-12", r.from());
        assertEquals("2026-11", r.to());
    }

    @Test
    void monthly_sumsTheActiveExpensesOfEachMonth() {
        when(expenses.findByGroupIdAndStatus("g1", ExpenseStatus.ACTIVE)).thenReturn(List.of(
                expense("2026-10-05", ExpenseCategory.FOOD, 1000, "youssef"),
                expense("2026-10-20", ExpenseCategory.RENT, 2000, "youssef"),
                expense("2026-11-01", ExpenseCategory.FOOD, 500, "youssef")));

        MonthlyReportResponse r = service.monthly("youssef", "g1", "2026-09", "2026-11");

        assertEquals(List.of(0L, 3000L, 500L), r.months().stream().map(MonthlyReportResponse.MonthlyPoint::totalMinor).toList());
        assertEquals(List.of(0, 2, 1), r.months().stream().map(MonthlyReportResponse.MonthlyPoint::count).toList());
    }

    @Test
    void monthly_onlyFrom_endsWithTheCurrentMonth_andOnlyTo_startsTwelveMonthsEarlier() {
        assertEquals("2026-11", service.monthly("youssef", "g1", "2026-09", null).to());
        assertEquals("2025-07", service.monthly("youssef", "g1", null, "2026-06").from());
    }

    @Test
    void monthly_rejectsMalformedReversedOrTooLongRanges() {
        assertEquals(ErrorCode.VALIDATION_FAILED, failure(() -> service.monthly("youssef", "g1", "2026-13", null)));
        assertEquals(ErrorCode.VALIDATION_FAILED, failure(() -> service.monthly("youssef", "g1", "November", null)));
        assertEquals(ErrorCode.VALIDATION_FAILED, failure(() -> service.monthly("youssef", "g1", "2026-10", "2026-09")));
        assertEquals(ErrorCode.VALIDATION_FAILED, failure(() -> service.monthly("youssef", "g1", "2020-01", "2026-11")));
        assertDoesNotThrow(() -> service.monthly("youssef", "g1", "2021-12", "2026-11"));   // exactly 60 months
    }

    // ---------------- categories ----------------

    @Test
    void categories_countOnlyTheExpensesOfThePeriod() {
        when(expenses.findByGroupIdAndStatus("g1", ExpenseStatus.ACTIVE)).thenReturn(List.of(
                expense("2026-09-30", ExpenseCategory.FOOD, 9999, "youssef"),
                expense("2026-10-01", ExpenseCategory.FOOD, 1000, "youssef"),
                expense("2026-10-31", ExpenseCategory.RENT, 3000, "youssef"),
                expense("2026-11-01", ExpenseCategory.RENT, 9999, "youssef")));

        CategoryReportResponse r = service.categories("youssef", "g1", LocalDate.parse("2026-10-01"), LocalDate.parse("2026-10-31"));

        assertEquals(4000L, r.totalMinor());
        assertEquals(List.of("RENT", "FOOD"), r.categories().stream().map(CategoryReportResponse.CategoryItem::category).toList());
        assertEquals(7500, r.categories().get(0).shareBp());
    }

    @Test
    void categories_withoutAPeriod_countEverything_andAnEmptyGroupHasNoCategories() {
        assertTrue(service.categories("youssef", "g1", null, null).categories().isEmpty());

        when(expenses.findByGroupIdAndStatus("g1", ExpenseStatus.ACTIVE)).thenReturn(List.of(
                expense("2020-01-01", ExpenseCategory.FOOD, 100, "youssef")));
        assertEquals(100L, service.categories("youssef", "g1", null, null).totalMinor());
    }

    @Test
    void categories_andContributions_rejectAReversedPeriod() {
        LocalDate later = LocalDate.parse("2026-11-01");
        LocalDate earlier = LocalDate.parse("2026-10-01");
        assertEquals(ErrorCode.VALIDATION_FAILED, failure(() -> service.categories("youssef", "g1", later, earlier)));
        assertEquals(ErrorCode.VALIDATION_FAILED, failure(() -> service.contributions("youssef", "g1", later, earlier)));
    }

    // ---------------- contributions ----------------

    @Test
    void contributions_listEveryMember_withNamesAndZeros() {
        ledgerOf(new HashMap<>(), Map.of(), List.of(member("youssef", MembershipStatus.ACTIVE),
                member("ahmed", MembershipStatus.ACTIVE), member("hamza", MembershipStatus.INACTIVE)));
        when(expenses.findByGroupIdAndStatus("g1", ExpenseStatus.ACTIVE)).thenReturn(List.of(
                expense("2026-10-05", ExpenseCategory.FOOD, 300, "youssef",
                        new ExpenseShare("youssef", 150, null), new ExpenseShare("ahmed", 150, null))));

        ContributionsResponse r = service.contributions("youssef", "g1", null, null);

        assertEquals(3, r.members().size());
        assertEquals(300L, r.members().get(0).paidMinor());
        assertEquals(150L, r.members().get(0).shareMinor());
        assertEquals("YOUSSEF", r.members().get(0).fullName());
        assertEquals(0L, r.members().get(2).paidMinor());
        assertEquals("hamza", r.members().get(2).username());
    }

    @Test
    void contributions_ofAnUnknownUser_doNotBreakTheReport() {
        ledgerOf(new HashMap<>(), Map.of(), List.of(member("youssef", MembershipStatus.ACTIVE), member("ghost", MembershipStatus.ACTIVE)));
        when(users.findAllById(any())).thenReturn(List.of(user("youssef")));

        assertEquals(ReportServiceImpl.UNKNOWN_USER, service.contributions("youssef", "g1", null, null).members().get(1).username());
    }

    @Test
    void theReportsNeverModifyAnything() {
        ledgerOf(new HashMap<>(), Map.of(), List.of(member("youssef", MembershipStatus.ACTIVE)));
        service.categories("youssef", "g1", null, null);
        service.contributions("youssef", "g1", null, null);
        service.monthly("youssef", "g1", null, null);

        verify(expenses, never()).save(any());
        verify(expenses, never()).deleteAll();
        verify(settlements, never()).save(any());
    }
}
