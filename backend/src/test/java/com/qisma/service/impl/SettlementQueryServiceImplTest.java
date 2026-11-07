package com.qisma.service.impl;

import com.qisma.dto.response.PageResponse;
import com.qisma.dto.response.SettlementResponse;
import com.qisma.dto.response.SuggestionsResponse;
import com.qisma.dto.response.TransferSuggestionResponse;
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
import com.qisma.repository.MembershipRepository;
import com.qisma.repository.SettlementQueryStore;
import com.qisma.repository.SettlementRepository;
import com.qisma.repository.UserRepository;
import com.qisma.security.GroupAccessGuard;
import com.qisma.service.finance.BalanceCalculator;
import com.qisma.service.finance.SettlementOptimizer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

class SettlementQueryServiceImplTest {

    private static final Instant T0 = Instant.parse("2026-11-01T10:00:00Z");

    private ExpenseRepository expenses;
    private MembershipRepository memberships;
    private SettlementRepository settlements;
    private SettlementQueryStore store;
    private UserRepository users;
    private GroupAccessGuard guard;
    private SettlementQueryServiceImpl service;

    @BeforeEach
    void setUp() {
        expenses = mock(ExpenseRepository.class);
        memberships = mock(MembershipRepository.class);
        settlements = mock(SettlementRepository.class);
        store = mock(SettlementQueryStore.class);
        users = mock(UserRepository.class);
        guard = mock(GroupAccessGuard.class);
        service = new SettlementQueryServiceImpl(guard, store,
                new LedgerServiceImpl(expenses, memberships, settlements, new BalanceCalculator()),
                users, new SettlementOptimizer());

        Group group = new Group();
        group.setId("g1");
        group.setCurrency("MAD");
        when(guard.forRead("g1", "youssef")).thenReturn(new GroupAccessGuard.Access(group,
                new Membership("g1", "youssef", GroupRole.OWNER, T0)));

        when(memberships.findByGroupId("g1")).thenReturn(List.of(
                new Membership("g1", "youssef", GroupRole.OWNER, T0),
                new Membership("g1", "ahmed", GroupRole.MEMBER, T0.plusSeconds(10)),
                new Membership("g1", "hamza", GroupRole.MEMBER, T0.plusSeconds(20))));
        when(users.findAllById(any())).thenReturn(List.of(
                user("youssef"), user("ahmed"), user("hamza")));
        when(store.search(any(), any(), any(), any())).thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 20), 0));
    }

    private static User user(String id) {
        User u = new User();
        u.setId(id);
        u.setUsername(id);
        u.setFullName(id);
        return u;
    }

    private static Settlement settlement(String id, String from, String to, long amount, SettlementStatus status) {
        Settlement s = new Settlement();
        s.setId(id);
        s.setGroupId("g1");
        s.setFromUserId(from);
        s.setToUserId(to);
        s.setAmountMinor(amount);
        s.setCurrency("MAD");
        s.setStatus(status);
        s.setCreatedAt(T0);
        return s;
    }

    private static Expense expense(String paidBy, long amount, ExpenseShare... shares) {
        Expense e = new Expense();
        e.setPaidBy(paidBy);
        e.setAmountMinor(amount);
        e.setStatus(ExpenseStatus.ACTIVE);
        e.setShares(List.of(shares));
        return e;
    }

    /** youssef +8333, ahmed -6667, hamza -1666 (cahier section 8.2, corrected). */
    private void cahierExpenses() {
        when(expenses.findByGroupIdAndStatus("g1", ExpenseStatus.ACTIVE)).thenReturn(List.of(
                expense("youssef", 30000, new ExpenseShare("youssef", 10000, null),
                        new ExpenseShare("ahmed", 10000, null), new ExpenseShare("hamza", 10000, null)),
                expense("ahmed", 15000, new ExpenseShare("youssef", 5000, null),
                        new ExpenseShare("ahmed", 5000, null), new ExpenseShare("hamza", 5000, null)),
                expense("hamza", 20000, new ExpenseShare("youssef", 6667, null),
                        new ExpenseShare("ahmed", 6667, null), new ExpenseShare("hamza", 6666, null))));
    }

    private static List<String> asText(SuggestionsResponse r) {
        return r.transfers().stream()
                .map(t -> t.fromUserId() + "->" + t.toUserId() + ":" + t.amountMinor()).toList();
    }

    // ---------------- suggestions ----------------

    @Test
    void suggestions_settleEveryoneWithTheFewestTransfers() {
        cahierExpenses();

        SuggestionsResponse r = service.suggestions("youssef", "g1");

        assertEquals("MAD", r.currency());
        assertEquals(List.of("ahmed->youssef:6667", "hamza->youssef:1666"), asText(r));
    }

    @Test
    void suggestions_doNotRepeatWhatIsAlreadyPending() {
        cahierExpenses();
        when(settlements.findByGroupIdAndStatus("g1", SettlementStatus.PENDING))
                .thenReturn(List.of(settlement("s1", "ahmed", "youssef", 3000, SettlementStatus.PENDING)));

        assertEquals(List.of("ahmed->youssef:3667", "hamza->youssef:1666"),
                asText(service.suggestions("youssef", "g1")));
    }

    @Test
    void suggestions_areEmptyOnceEverythingIsSettled() {
        cahierExpenses();
        when(settlements.findByGroupIdAndStatus("g1", SettlementStatus.CONFIRMED)).thenReturn(List.of(
                settlement("s1", "ahmed", "youssef", 6667, SettlementStatus.CONFIRMED),
                settlement("s2", "hamza", "youssef", 1666, SettlementStatus.CONFIRMED)));

        assertTrue(service.suggestions("youssef", "g1").transfers().isEmpty());
    }

    @Test
    void suggestions_fullyCoveredByPendingSettlements_areEmpty() {
        cahierExpenses();
        when(settlements.findByGroupIdAndStatus("g1", SettlementStatus.PENDING)).thenReturn(List.of(
                settlement("s1", "ahmed", "youssef", 6667, SettlementStatus.PENDING),
                settlement("s2", "hamza", "youssef", 1666, SettlementStatus.PENDING)));

        assertTrue(service.suggestions("youssef", "g1").transfers().isEmpty());
    }

    @Test
    void suggestions_includeAMemberWhoLeftButStillOwes() {
        Membership gone = new Membership("g1", "hamza", GroupRole.MEMBER, T0.plusSeconds(20));
        gone.setStatus(MembershipStatus.INACTIVE);
        when(memberships.findByGroupId("g1")).thenReturn(List.of(
                new Membership("g1", "youssef", GroupRole.OWNER, T0), gone));
        when(expenses.findByGroupIdAndStatus("g1", ExpenseStatus.ACTIVE)).thenReturn(List.of(
                expense("youssef", 3000, new ExpenseShare("youssef", 1000, null), new ExpenseShare("hamza", 2000, null))));

        assertEquals(List.of("hamza->youssef:2000"), asText(service.suggestions("youssef", "g1")));
    }

    @Test
    void suggestions_carryUsernames_andStoreNothing() {
        cahierExpenses();

        TransferSuggestionResponse first = service.suggestions("youssef", "g1").transfers().get(0);

        assertEquals("ahmed", first.fromUsername());
        assertEquals("youssef", first.toUsername());
        verify(settlements, never()).save(any());
        verify(settlements, never()).deleteAll();
    }

    @Test
    void suggestions_forANonMember_areRejected() {
        when(guard.forRead("g1", "stranger")).thenThrow(new ApiException(ErrorCode.NOT_FOUND, "Group not found"));

        assertThrows(ApiException.class, () -> service.suggestions("stranger", "g1"));
        verifyNoInteractions(expenses, settlements, users);
    }

    // ---------------- list ----------------

    @Test
    void list_mapsThePage_withUsernames_andPassesTheFilters() {
        when(store.search(eq("g1"), eq(SettlementStatus.PENDING), eq("ahmed"), any())).thenReturn(new PageImpl<>(
                List.of(settlement("s1", "ahmed", "youssef", 3000, SettlementStatus.PENDING)),
                PageRequest.of(0, 20), 1));

        PageResponse<SettlementResponse> r = service.list("youssef", "g1", SettlementStatus.PENDING, " ahmed ", 0, 20);

        assertEquals(1, r.totalElements());
        assertEquals("ahmed", r.items().get(0).fromUsername());
        assertEquals("youssef", r.items().get(0).toUsername());
        assertEquals(3000L, r.items().get(0).amountMinor());
        assertEquals(SettlementStatus.PENDING, r.items().get(0).status());
    }

    @Test
    void list_asksForNewestFirst_withTheRequestedWindow() {
        service.list("youssef", "g1", null, null, 2, 30);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(store).search(eq("g1"), isNull(), isNull(), pageable.capture());
        assertEquals(2, pageable.getValue().getPageNumber());
        assertEquals(30, pageable.getValue().getPageSize());
        assertTrue(pageable.getValue().getSort().getOrderFor("createdAt").isDescending());
    }

    @Test
    void list_treatsABlankMemberFilterAsNoFilter() {
        service.list("youssef", "g1", null, "  ", 0, 20);
        verify(store).search(eq("g1"), isNull(), isNull(), any());
    }

    @Test
    void list_rejectsInvalidPagination() {
        for (int[] bad : new int[][]{{-1, 20}, {0, 0}, {0, SettlementQueryServiceImpl.MAX_PAGE_SIZE + 1}}) {
            assertEquals(ErrorCode.VALIDATION_FAILED, assertThrows(ApiException.class,
                    () -> service.list("youssef", "g1", null, null, bad[0], bad[1])).getCode());
        }
        verify(store, never()).search(any(), any(), any(), any());
    }

    @Test
    void list_forANonMember_isRejectedBeforeAnythingElse() {
        when(guard.forRead("g1", "stranger")).thenThrow(new ApiException(ErrorCode.NOT_FOUND, "Group not found"));

        ApiException e = assertThrows(ApiException.class, () -> service.list("stranger", "g1", null, null, -5, 999));

        assertEquals(ErrorCode.NOT_FOUND, e.getCode());
        verifyNoInteractions(store);
    }
}
