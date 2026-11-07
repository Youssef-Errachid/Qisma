package com.qisma.integration;

import com.qisma.dto.request.ActivitySearchCriteria;
import com.qisma.dto.request.CreateExpenseRequest;
import com.qisma.dto.request.ParticipantInput;
import com.qisma.dto.response.ActivityResponse;
import com.qisma.dto.response.CategoryReportResponse;
import com.qisma.dto.response.ContributionsResponse;
import com.qisma.dto.response.MonthlyReportResponse;
import com.qisma.dto.response.PageResponse;
import com.qisma.dto.response.ReportSummaryResponse;
import com.qisma.enums.ActivityAction;
import com.qisma.enums.ActivityEntityType;
import com.qisma.enums.ExpenseCategory;
import com.qisma.enums.SplitMethod;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.service.ActivityQueryService;
import com.qisma.service.ReportService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** The reports and the history read through the real mapping, with real dates, enums and nested values. */
class ReportsAndActivityIT extends IntegrationTestSupport {

    @Autowired ReportService reports;
    @Autowired ActivityQueryService activity;

    /** The owner pays; the owner and ahmed share equally (hamza takes no part). */
    private String expenseOn(Fixture f, String date, ExpenseCategory category, long amount) {
        return expenseService.create(f.owner(), f.groupId(), new CreateExpenseRequest("t", null, amount, null, f.owner(),
                LocalDate.parse(date), category, SplitMethod.EQUAL,
                List.of(new ParticipantInput(f.owner(), null, null), new ParticipantInput(f.ahmed(), null, null)))).id();
    }

    private Fixture seeded() {
        Fixture f = newGroup();
        expenseOn(f, "2026-09-15", ExpenseCategory.FOOD, 400);
        expenseOn(f, "2026-10-05", ExpenseCategory.FOOD, 1000);
        expenseOn(f, "2026-10-20", ExpenseCategory.RENT, 2000);
        expenseOn(f, "2026-11-01", ExpenseCategory.FOOD, 500);
        return f;
    }

    @Test
    void monthly_groupsTheStoredDatesIntoMonths_andFillsTheEmptyOnes() {
        Fixture f = seeded();

        MonthlyReportResponse r = reports.monthly(f.owner(), f.groupId(), "2026-08", "2026-11");

        assertEquals(List.of("2026-08", "2026-09", "2026-10", "2026-11"),
                r.months().stream().map(MonthlyReportResponse.MonthlyPoint::month).toList());
        assertEquals(List.of(0L, 400L, 3000L, 500L), r.months().stream().map(MonthlyReportResponse.MonthlyPoint::totalMinor).toList());
        assertEquals(List.of(0, 1, 2, 1), r.months().stream().map(MonthlyReportResponse.MonthlyPoint::count).toList());
    }

    @Test
    void categories_filterByPeriod_andTheDeletedExpensesDoNotCount() {
        Fixture f = seeded();
        String rent = expenseOn(f, "2026-10-25", ExpenseCategory.RENT, 7000);
        expenseService.delete(f.owner(), f.groupId(), rent);

        CategoryReportResponse r = reports.categories(f.owner(), f.groupId(), LocalDate.parse("2026-10-01"), LocalDate.parse("2026-10-31"));

        assertEquals(3000L, r.totalMinor(), "the deleted 70.00 must not count");
        assertEquals("RENT", r.categories().get(0).category());
        assertEquals(2000L, r.categories().get(0).totalMinor());
        assertEquals(6667, r.categories().get(0).shareBp());
    }

    @Test
    void contributions_addUpToTheExpenses() {
        Fixture f = seeded();

        ContributionsResponse r = reports.contributions(f.owner(), f.groupId(), null, null);

        long paid = r.members().stream().mapToLong(ContributionsResponse.MemberContribution::paidMinor).sum();
        long share = r.members().stream().mapToLong(ContributionsResponse.MemberContribution::shareMinor).sum();
        assertEquals(3, r.members().size(), "hamza took no part but is still listed");
        assertEquals(3900L, paid);
        assertEquals(3900L, share);
        assertEquals(3900L, r.members().get(0).paidMinor(), "the owner paid everything");
        assertEquals(0L, r.members().get(2).paidMinor() + r.members().get(2).shareMinor());
    }

    @Test
    void summary_matchesTheBalances() {
        Fixture f = seeded();

        ReportSummaryResponse r = reports.summary(f.owner(), f.groupId());

        assertEquals(3900L, r.totalExpensesMinor());
        assertEquals(4L, r.expenseCount());
        assertEquals(3, r.memberCount());
        assertEquals(3, r.activeMemberCount());
        assertEquals(1950L, r.outstandingDebtsMinor(), "ahmed owes half of everything");
        assertEquals(0L, r.confirmedSettlementsMinor());
        assertEquals(0, r.pendingSettlementsCount());
    }

    @Test
    void aStrangerCannotReadTheReports() {
        Fixture f = seeded();

        assertEquals(ErrorCode.NOT_FOUND, assertThrows(ApiException.class,
                () -> reports.summary("someone-else", f.groupId())).getCode());
    }

    @Test
    void activity_listsTheHistoryNewestFirst_withReadableValues() {
        Fixture f = newGroup();
        String first = expenseOn(f, "2026-10-05", ExpenseCategory.FOOD, 1000);
        expenseOn(f, "2026-10-06", ExpenseCategory.FOOD, 2000);
        expenseService.delete(f.owner(), f.groupId(), first);

        PageResponse<ActivityResponse> page = activity.list(f.owner(), f.groupId(),
                new ActivitySearchCriteria(null, null, null, null, null, null), 0, 20);

        assertEquals(3, page.totalElements());
        assertEquals(ActivityAction.EXPENSE_DELETED, page.items().get(0).action(), "the newest line comes first");
        assertEquals(ActivityAction.EXPENSE_CREATED, page.items().get(2).action());
        assertEquals(1000L, ((Number) page.items().get(0).oldValue().get("amountMinor")).longValue());
        assertEquals("DELETED", page.items().get(0).newValue().get("status"));
        assertEquals(f.owner(), page.items().get(0).actorId());
    }

    @Test
    void activity_filtersByEntityActionAndPeriod_andPaginates() {
        Fixture f = newGroup();
        String first = expenseOn(f, "2026-10-05", ExpenseCategory.FOOD, 1000);
        expenseOn(f, "2026-10-06", ExpenseCategory.FOOD, 2000);
        expenseService.delete(f.owner(), f.groupId(), first);

        assertEquals(2L, activity.list(f.owner(), f.groupId(),
                new ActivitySearchCriteria(null, null, null, first, null, null), 0, 20).totalElements(),
                "the history of one expense: created and deleted");
        assertEquals(1L, activity.list(f.owner(), f.groupId(),
                new ActivitySearchCriteria(null, ActivityAction.EXPENSE_DELETED, null, null, null, null), 0, 20).totalElements());
        assertEquals(3L, activity.list(f.owner(), f.groupId(),
                new ActivitySearchCriteria(null, null, ActivityEntityType.EXPENSE, null, null, null), 0, 20).totalElements());
        assertEquals(0L, activity.list(f.owner(), f.groupId(),
                new ActivitySearchCriteria(null, null, ActivityEntityType.SETTLEMENT, null, null, null), 0, 20).totalElements());
        assertEquals(0L, activity.list(f.owner(), f.groupId(),
                new ActivitySearchCriteria(null, null, null, null, LocalDate.of(2000, 1, 1), LocalDate.of(2000, 1, 2)), 0, 20).totalElements());
        assertEquals(3L, activity.list(f.owner(), f.groupId(),
                new ActivitySearchCriteria(null, null, null, null, LocalDate.now().minusDays(1), LocalDate.now().plusDays(1)), 0, 20).totalElements());
        assertEquals(0L, activity.list(f.owner(), f.groupId(),
                new ActivitySearchCriteria("somebody-else", null, null, null, null, null), 0, 20).totalElements());

        PageResponse<ActivityResponse> secondPage = activity.list(f.owner(), f.groupId(),
                new ActivitySearchCriteria(null, null, null, null, null, null), 1, 2);
        assertEquals(1, secondPage.items().size());
        assertEquals(2, secondPage.totalPages());
    }

    @Test
    void activity_ofAnotherGroup_isNeverVisible() {
        Fixture mine = newGroup();
        Fixture other = newGroup();
        expenseOn(other, "2026-10-05", ExpenseCategory.FOOD, 1000);

        assertEquals(0L, activity.list(mine.owner(), mine.groupId(),
                new ActivitySearchCriteria(null, null, null, null, null, null), 0, 20).totalElements());
        assertEquals(ErrorCode.NOT_FOUND, assertThrows(ApiException.class, () -> activity.list(mine.owner(), other.groupId(),
                new ActivitySearchCriteria(null, null, null, null, null, null), 0, 20)).getCode());
    }
}
