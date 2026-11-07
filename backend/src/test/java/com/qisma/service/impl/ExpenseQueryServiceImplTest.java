package com.qisma.service.impl;

import com.qisma.dto.request.ExpenseSearchCriteria;
import com.qisma.dto.response.ExpenseResponse;
import com.qisma.dto.response.PageResponse;
import com.qisma.enums.ExpenseCategory;
import com.qisma.enums.ExpenseStatus;
import com.qisma.enums.GroupRole;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.mapper.ExpenseMapper;
import com.qisma.model.Expense;
import com.qisma.model.ExpenseShare;
import com.qisma.model.Group;
import com.qisma.model.Membership;
import com.qisma.repository.ExpenseQueryStore;
import com.qisma.repository.ExpenseRepository;
import com.qisma.security.GroupAccessGuard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ExpenseQueryServiceImplTest {

    private static final Instant NOW = Instant.parse("2026-11-07T12:00:00Z");
    private static final ExpenseSearchCriteria NONE = new ExpenseSearchCriteria(null, null, null, null, null, null);

    private ExpenseRepository expenses;
    private ExpenseQueryStore store;
    private GroupAccessGuard guard;
    private ExpenseQueryServiceImpl service;

    @BeforeEach
    void setUp() {
        expenses = mock(ExpenseRepository.class);
        store = mock(ExpenseQueryStore.class);
        guard = mock(GroupAccessGuard.class);
        service = new ExpenseQueryServiceImpl(expenses, store, guard, new ExpenseMapper());

        Group group = new Group();
        group.setId("g1");
        when(guard.forRead("g1", "youssef")).thenReturn(new GroupAccessGuard.Access(group,
                new Membership("g1", "youssef", GroupRole.MEMBER, NOW)));
        when(store.search(any(), any(), any())).thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));
    }

    private static Expense expense(String id, ExpenseStatus status) {
        Expense e = new Expense();
        e.setId(id);
        e.setGroupId("g1");
        e.setTitle("Title " + id);
        e.setAmountMinor(1000);
        e.setCurrency("MAD");
        e.setCategory(ExpenseCategory.FOOD);
        e.setExpenseDate(LocalDate.parse("2026-11-07"));
        e.setStatus(status);
        e.setShares(List.of(new ExpenseShare("youssef", 600, null), new ExpenseShare("ahmed", 400, null)));
        return e;
    }

    private ErrorCode listFailure(ExpenseSearchCriteria criteria, int page, int size) {
        ErrorCode code = assertThrows(ApiException.class,
                () -> service.list("youssef", "g1", criteria, page, size)).getCode();
        verify(store, never()).search(any(), any(), any());
        return code;
    }

    @Test
    void list_mapsThePage_andReportsTheTotals() {
        when(store.search(eq("g1"), any(), any())).thenReturn(new PageImpl<>(
                List.of(expense("e1", ExpenseStatus.ACTIVE), expense("e2", ExpenseStatus.ACTIVE)),
                PageRequest.of(1, 2), 5));

        PageResponse<ExpenseResponse> r = service.list("youssef", "g1", NONE, 1, 2);

        assertEquals(2, r.items().size());
        assertEquals(1, r.page());
        assertEquals(2, r.size());
        assertEquals(5, r.totalElements());
        assertEquals(3, r.totalPages());
        assertEquals(2, r.items().get(0).shares().size());
    }

    @Test
    void list_asksTheStoreForNewestFirst_withTheRequestedWindow() {
        service.list("youssef", "g1", NONE, 2, 30);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(store).search(eq("g1"), any(), pageable.capture());
        assertEquals(2, pageable.getValue().getPageNumber());
        assertEquals(30, pageable.getValue().getPageSize());
        assertTrue(pageable.getValue().getSort().getOrderFor("expenseDate").isDescending());
        assertTrue(pageable.getValue().getSort().getOrderFor("_id").isDescending());
    }

    @Test
    void list_trimsTheSearchText_andTreatsBlankAsNoFilter() {
        service.list("youssef", "g1", new ExpenseSearchCriteria(null, null, null, " ", "  ", "  coffee "), 0, 20);
        service.list("youssef", "g1", new ExpenseSearchCriteria(null, null, null, null, null, "   "), 0, 20);

        ArgumentCaptor<ExpenseSearchCriteria> captor = ArgumentCaptor.forClass(ExpenseSearchCriteria.class);
        verify(store, times(2)).search(eq("g1"), captor.capture(), any());
        assertEquals("coffee", captor.getAllValues().get(0).q());
        assertNull(captor.getAllValues().get(0).paidBy());
        assertNull(captor.getAllValues().get(0).participant());
        assertNull(captor.getAllValues().get(1).q());
    }

    @Test
    void list_acceptsTheBoundaryPageSize() {
        assertDoesNotThrow(() -> service.list("youssef", "g1", NONE, 0, ExpenseQueryServiceImpl.MAX_PAGE_SIZE));
        assertDoesNotThrow(() -> service.list("youssef", "g1", NONE, 0, 1));
    }

    @Test
    void list_rejectsInvalidPagination() {
        assertEquals(ErrorCode.VALIDATION_FAILED, listFailure(NONE, -1, 20));
        assertEquals(ErrorCode.VALIDATION_FAILED, listFailure(NONE, 0, 0));
        assertEquals(ErrorCode.VALIDATION_FAILED, listFailure(NONE, 0, ExpenseQueryServiceImpl.MAX_PAGE_SIZE + 1));
    }

    @Test
    void list_rejectsAReversedDateRange() {
        assertEquals(ErrorCode.VALIDATION_FAILED, listFailure(new ExpenseSearchCriteria(
                LocalDate.parse("2026-11-08"), LocalDate.parse("2026-11-01"), null, null, null, null), 0, 20));
    }

    @Test
    void list_acceptsASingleDayRange() {
        LocalDate day = LocalDate.parse("2026-11-07");
        assertDoesNotThrow(() -> service.list("youssef", "g1",
                new ExpenseSearchCriteria(day, day, null, null, null, null), 0, 20));
    }

    @Test
    void list_rejectsTooLongSearchText() {
        assertEquals(ErrorCode.VALIDATION_FAILED, listFailure(new ExpenseSearchCriteria(
                null, null, null, null, null, "x".repeat(ExpenseQueryServiceImpl.MAX_SEARCH_LENGTH + 1)), 0, 20));
    }

    @Test
    void list_aNonMember_isRejectedByTheGuard_beforeAnythingElse() {
        when(guard.forRead("g1", "stranger")).thenThrow(new ApiException(ErrorCode.NOT_FOUND, "Group not found"));

        // even invalid parameters give 404 first, so nothing about the group leaks
        ApiException e = assertThrows(ApiException.class, () -> service.list("stranger", "g1", NONE, -5, 999));

        assertEquals(ErrorCode.NOT_FOUND, e.getCode());
        verifyNoInteractions(store);
    }

    @Test
    void get_returnsTheExpenseWithItsShares() {
        when(expenses.findByIdAndGroupId("e1", "g1")).thenReturn(Optional.of(expense("e1", ExpenseStatus.ACTIVE)));

        ExpenseResponse r = service.get("youssef", "g1", "e1");

        assertEquals("e1", r.id());
        assertEquals(List.of(600L, 400L), r.shares().stream().map(s -> s.shareMinor()).toList());
    }

    @Test
    void get_aDeletedExpense_isNotFound() {
        when(expenses.findByIdAndGroupId("e1", "g1")).thenReturn(Optional.of(expense("e1", ExpenseStatus.DELETED)));

        assertEquals(ErrorCode.NOT_FOUND,
                assertThrows(ApiException.class, () -> service.get("youssef", "g1", "e1")).getCode());
    }

    @Test
    void get_anExpenseOfAnotherGroupOrUnknown_isNotFound() {
        when(expenses.findByIdAndGroupId("e9", "g1")).thenReturn(Optional.empty());

        assertEquals(ErrorCode.NOT_FOUND,
                assertThrows(ApiException.class, () -> service.get("youssef", "g1", "e9")).getCode());
    }

    @Test
    void get_aNonMember_isRejected_andTheRepositoryIsNotTouched() {
        when(guard.forRead("g1", "stranger")).thenThrow(new ApiException(ErrorCode.NOT_FOUND, "Group not found"));

        assertThrows(ApiException.class, () -> service.get("stranger", "g1", "e1"));
        verifyNoInteractions(expenses);
    }
}
