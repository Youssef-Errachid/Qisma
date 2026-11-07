package com.qisma.service.impl;

import com.qisma.dto.request.CreateExpenseRequest;
import com.qisma.dto.request.ParticipantInput;
import com.qisma.dto.request.UpdateExpenseRequest;
import com.qisma.dto.response.ExpenseResponse;
import com.qisma.enums.ActivityAction;
import com.qisma.enums.ExpenseCategory;
import com.qisma.enums.ExpenseStatus;
import com.qisma.enums.GroupRole;
import com.qisma.enums.MembershipStatus;
import com.qisma.enums.SplitMethod;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.mapper.ExpenseMapper;
import com.qisma.model.Expense;
import com.qisma.model.ExpenseShare;
import com.qisma.model.Group;
import com.qisma.model.Membership;
import com.qisma.repository.ExpenseRepository;
import com.qisma.repository.GroupLedgerStore;
import com.qisma.repository.MembershipRepository;
import com.qisma.security.GroupAccessGuard;
import com.qisma.service.ActivityLogService;
import com.qisma.service.finance.SplitStrategyFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

@SuppressWarnings({"unchecked", "rawtypes"})
class ExpenseServiceImplTest {

    private static final Instant NOW = Instant.parse("2026-11-07T12:00:00Z");

    private ExpenseRepository expenses;
    private MembershipRepository memberships;
    private GroupAccessGuard guard;
    private GroupLedgerStore ledger;
    private ActivityLogService activity;
    private ExpenseServiceImpl service;
    private Group group;

    @BeforeEach
    void setUp() {
        expenses = mock(ExpenseRepository.class);
        memberships = mock(MembershipRepository.class);
        guard = mock(GroupAccessGuard.class);
        ledger = mock(GroupLedgerStore.class);
        activity = mock(ActivityLogService.class);
        service = new ExpenseServiceImpl(expenses, guard,
                new ExpenseAllocator(memberships, new SplitStrategyFactory()),
                ledger, activity, new ExpenseMapper(), Clock.fixed(NOW, ZoneOffset.UTC));

        group = new Group();
        group.setId("g1");
        group.setCurrency("MAD");
        actsAs("youssef", GroupRole.MEMBER);
        actsAs("ahmed", GroupRole.MEMBER);
        actsAs("hamza", GroupRole.MEMBER);
        actsAs("boss", GroupRole.OWNER);

        when(memberships.findByGroupIdAndStatus("g1", MembershipStatus.ACTIVE)).thenReturn(List.of(
                new Membership("g1", "youssef", GroupRole.OWNER, NOW),
                new Membership("g1", "ahmed", GroupRole.MEMBER, NOW),
                new Membership("g1", "hamza", GroupRole.MEMBER, NOW)));

        when(expenses.save(any(Expense.class))).thenAnswer(inv -> {
            Expense e = inv.getArgument(0);
            if (e.getId() == null) {
                e.setId("e1");
            }
            return e;
        });
    }

    private void actsAs(String userId, GroupRole role) {
        when(guard.forWrite("g1", userId)).thenReturn(new GroupAccessGuard.Access(group,
                new Membership("g1", userId, role, NOW)));
    }

    private static ParticipantInput equal(String userId) {
        return new ParticipantInput(userId, null, null);
    }

    private static ParticipantInput custom(String userId, long share) {
        return new ParticipantInput(userId, share, null);
    }

    private static ParticipantInput pct(String userId, int bp) {
        return new ParticipantInput(userId, null, bp);
    }

    private static CreateExpenseRequest request(String paidBy, long amount, SplitMethod method,
                                                ParticipantInput... participants) {
        return new CreateExpenseRequest("Grocery Shopping", null, amount, null, paidBy,
                LocalDate.parse("2026-11-07"), ExpenseCategory.FOOD, method, List.of(participants));
    }

    private Expense saved() {
        ArgumentCaptor<Expense> captor = ArgumentCaptor.forClass(Expense.class);
        verify(expenses).save(captor.capture());
        return captor.getValue();
    }

    private static List<Long> shares(Expense e) {
        return e.getShares().stream().map(ExpenseShare::shareMinor).toList();
    }

    private ErrorCode failureOf(CreateExpenseRequest request) {
        ErrorCode code = assertThrows(ApiException.class, () -> service.create("youssef", "g1", request)).getCode();
        verify(expenses, never()).save(any());
        verify(ledger, never()).advance(any());
        verify(activity, never()).record(any(), any(), any(), any(), any(), any());
        return code;
    }

    // ======================= create =======================

    @Test
    void equalSplit_cahierExample_300MadBetweenThree() {
        ExpenseResponse r = service.create("youssef", "g1",
                request("youssef", 30000, SplitMethod.EQUAL, equal("youssef"), equal("ahmed"), equal("hamza")));

        Expense e = saved();
        assertEquals(List.of(10000L, 10000L, 10000L), shares(e));
        assertEquals("MAD", e.getCurrency());
        assertEquals("youssef", e.getPaidBy());
        assertEquals("youssef", e.getCreatedBy());
        assertEquals(NOW, e.getCreatedAt());
        assertEquals(ExpenseStatus.ACTIVE, e.getStatus());
        assertEquals("e1", r.id());
        assertEquals(3, r.shares().size());
    }

    @Test
    void create_recordsTheCreationInTheHistory_withoutAnOldValue() {
        service.create("youssef", "g1", request("youssef", 1000, SplitMethod.EQUAL, equal("youssef")));

        ArgumentCaptor<Map> after = ArgumentCaptor.forClass(Map.class);
        verify(activity).record(eq("g1"), eq("youssef"), eq(ActivityAction.EXPENSE_CREATED), eq("e1"),
                isNull(), after.capture());
        assertEquals(1000L, after.getValue().get("amountMinor"));
    }

    @Test
    void equalSplit_remainderGoesToTheFirstParticipants() {
        service.create("youssef", "g1",
                request("ahmed", 10000, SplitMethod.EQUAL, equal("youssef"), equal("ahmed"), equal("hamza")));

        assertEquals(List.of(3334L, 3333L, 3333L), shares(saved()));
    }

    @Test
    void customSplit_cahierExample_150_100_50() {
        service.create("youssef", "g1", request("youssef", 30000, SplitMethod.CUSTOM,
                custom("youssef", 15000), custom("ahmed", 10000), custom("hamza", 5000)));

        assertEquals(List.of(15000L, 10000L, 5000L), shares(saved()));
    }

    @Test
    void percentageSplit_cahierExample_400Mad_50_30_20() {
        service.create("youssef", "g1", request("youssef", 40000, SplitMethod.PERCENTAGE,
                pct("youssef", 5000), pct("ahmed", 3000), pct("hamza", 2000)));

        Expense e = saved();
        assertEquals(List.of(20000L, 12000L, 8000L), shares(e));
        assertEquals(5000, e.getShares().get(0).percentageBp());
    }

    @Test
    void payerMayNotBeAParticipant() {
        service.create("youssef", "g1",
                request("youssef", 30000, SplitMethod.EQUAL, equal("ahmed"), equal("hamza")));

        Expense e = saved();
        assertEquals("youssef", e.getPaidBy());
        assertEquals(List.of(15000L, 15000L), shares(e));
    }

    @Test
    void anotherMemberMayBeRecordedAsThePayer_andTheCreatorIsKept() {
        service.create("youssef", "g1", request("hamza", 900, SplitMethod.EQUAL, equal("youssef")));

        Expense e = saved();
        assertEquals("hamza", e.getPaidBy());
        assertEquals("youssef", e.getCreatedBy());
    }

    @Test
    void payerWhoIsNotAnActiveMember_isRejected() {
        assertEquals(ErrorCode.PARTICIPANT_NOT_MEMBER,
                failureOf(request("gone", 1000, SplitMethod.EQUAL, equal("youssef"))));
    }

    @Test
    void participantWhoIsNotAnActiveMember_isRejected() {
        assertEquals(ErrorCode.PARTICIPANT_NOT_MEMBER,
                failureOf(request("youssef", 1000, SplitMethod.EQUAL, equal("youssef"), equal("outsider"))));
    }

    @Test
    void customSplit_whoseSumIsWrong_isRejected_andNothingIsSaved() {
        assertEquals(ErrorCode.INVALID_SPLIT, failureOf(request("youssef", 30000, SplitMethod.CUSTOM,
                custom("youssef", 15000), custom("ahmed", 10000), custom("hamza", 4999))));
    }

    @Test
    void percentageSplit_notTotalling100_isRejected() {
        assertEquals(ErrorCode.INVALID_SPLIT, failureOf(request("youssef", 40000, SplitMethod.PERCENTAGE,
                pct("youssef", 5000), pct("ahmed", 3000), pct("hamza", 1999))));
    }

    @Test
    void equalSplit_refusesClientSuppliedAmounts() {
        assertEquals(ErrorCode.INVALID_SPLIT, failureOf(request("youssef", 30000, SplitMethod.EQUAL,
                custom("youssef", 30000), equal("ahmed"))));
    }

    @Test
    void duplicateParticipants_areRejected() {
        assertEquals(ErrorCode.INVALID_SPLIT, failureOf(request("youssef", 1000, SplitMethod.EQUAL,
                equal("ahmed"), equal("ahmed"))));
    }

    @Test
    void currencyDifferentFromTheGroup_isRejected() {
        CreateExpenseRequest eur = new CreateExpenseRequest("Trip", null, 1000L, "EUR", "youssef",
                LocalDate.parse("2026-11-07"), ExpenseCategory.OTHER, SplitMethod.EQUAL, List.of(equal("youssef")));
        assertEquals(ErrorCode.VALIDATION_FAILED, failureOf(eur));
    }

    @Test
    void sameCurrencyInAnyCase_isAccepted() {
        CreateExpenseRequest mad = new CreateExpenseRequest("Trip", null, 1000L, " mad ", "youssef",
                LocalDate.parse("2026-11-07"), ExpenseCategory.OTHER, SplitMethod.EQUAL, List.of(equal("youssef")));
        assertDoesNotThrow(() -> service.create("youssef", "g1", mad));
    }

    @Test
    void aNonMember_isRejectedByTheGuard_andNothingElseIsTouched() {
        when(guard.forWrite("g1", "stranger"))
                .thenThrow(new ApiException(ErrorCode.NOT_FOUND, "Group not found"));

        ApiException e = assertThrows(ApiException.class, () -> service.create("stranger", "g1",
                request("youssef", 1000, SplitMethod.EQUAL, equal("youssef"))));

        assertEquals(ErrorCode.NOT_FOUND, e.getCode());
        verifyNoInteractions(expenses, ledger, activity);
    }

    @Test
    void textIsNormalised() {
        CreateExpenseRequest r = new CreateExpenseRequest("  Internet  ", "   ", 1000L, null, "youssef",
                LocalDate.parse("2026-11-07"), ExpenseCategory.INTERNET, SplitMethod.EQUAL, List.of(equal("youssef")));
        service.create("youssef", "g1", r);

        Expense e = saved();
        assertEquals("Internet", e.getTitle());
        assertNull(e.getDescription());
        assertEquals(LocalDate.parse("2026-11-07"), e.getExpenseDate());
    }

    @Test
    void ledgerVersionIsAdvancedExactlyOnce_perCreatedExpense() {
        service.create("youssef", "g1", request("youssef", 1000, SplitMethod.EQUAL, equal("youssef")));
        verify(ledger, times(1)).advance("g1");
    }

    @Test
    void property_theSharesAlwaysAddUpToTheAmount() {
        Random random = new Random(5);
        for (int round = 0; round < 300; round++) {
            long amount = 1 + random.nextInt(500_000);
            clearInvocations(expenses);
            service.create("youssef", "g1", request("youssef", amount, SplitMethod.EQUAL,
                    equal("youssef"), equal("ahmed"), equal("hamza")));
            Expense e = saved();
            assertEquals(amount, e.getShares().stream().mapToLong(ExpenseShare::shareMinor).sum(), "round " + round);
        }
    }

    // ======================= update =======================

    private Expense existing(String createdBy, ExpenseStatus status) {
        Expense e = new Expense();
        e.setId("e1");
        e.setGroupId("g1");
        e.setTitle("Old title");
        e.setAmountMinor(30000);
        e.setCurrency("MAD");
        e.setPaidBy("youssef");
        e.setCategory(ExpenseCategory.FOOD);
        e.setSplitMethod(SplitMethod.EQUAL);
        e.setShares(List.of(new ExpenseShare("youssef", 10000, null),
                new ExpenseShare("ahmed", 10000, null), new ExpenseShare("hamza", 10000, null)));
        e.setExpenseDate(LocalDate.parse("2026-11-07"));
        e.setStatus(status);
        e.setCreatedBy(createdBy);
        e.setVersion(3L);
        when(expenses.findByIdAndGroupId("e1", "g1")).thenReturn(Optional.of(e));
        return e;
    }

    private static UpdateExpenseRequest update(Long version, String paidBy, long amount, SplitMethod method,
                                               ParticipantInput... participants) {
        return new UpdateExpenseRequest(version, "  New title ", " note ", amount, null, paidBy,
                LocalDate.parse("2026-11-08"), ExpenseCategory.RENT, method, List.of(participants));
    }

    private ErrorCode updateFailure(String actor, UpdateExpenseRequest request) {
        ErrorCode code = assertThrows(ApiException.class, () -> service.update(actor, "g1", "e1", request)).getCode();
        verify(expenses, never()).save(any());
        verify(ledger, never()).advance(any());
        verify(activity, never()).record(any(), any(), any(), any(), any(), any());
        return code;
    }

    @Test
    void update_theCreator_recomputesTheShares_andRecordsOldAndNewValues() {
        Expense e = existing("youssef", ExpenseStatus.ACTIVE);

        ExpenseResponse r = service.update("youssef", "g1", "e1",
                update(3L, "ahmed", 45000, SplitMethod.EQUAL, equal("youssef"), equal("ahmed")));

        assertEquals("New title", e.getTitle());
        assertEquals("note", e.getDescription());
        assertEquals(45000L, e.getAmountMinor());
        assertEquals("ahmed", e.getPaidBy());
        assertEquals(ExpenseCategory.RENT, e.getCategory());
        assertEquals(LocalDate.parse("2026-11-08"), e.getExpenseDate());
        assertEquals(List.of(22500L, 22500L), shares(e));
        assertEquals("youssef", e.getUpdatedBy());
        assertEquals(NOW, e.getUpdatedAt());
        assertEquals("youssef", e.getCreatedBy());
        assertEquals("e1", r.id());

        ArgumentCaptor<Map> before = ArgumentCaptor.forClass(Map.class);
        ArgumentCaptor<Map> after = ArgumentCaptor.forClass(Map.class);
        verify(activity).record(eq("g1"), eq("youssef"), eq(ActivityAction.EXPENSE_UPDATED), eq("e1"),
                before.capture(), after.capture());
        assertEquals(30000L, before.getValue().get("amountMinor"));
        assertEquals("Old title", before.getValue().get("title"));
        assertEquals(3, ((List) before.getValue().get("shares")).size());
        assertEquals(45000L, after.getValue().get("amountMinor"));
        assertEquals(2, ((List) after.getValue().get("shares")).size());
        verify(ledger, times(1)).advance("g1");
    }

    @Test
    void update_theGroupOwner_mayModerateSomeoneElsesExpense() {
        Expense e = existing("youssef", ExpenseStatus.ACTIVE);

        service.update("boss", "g1", "e1", update(3L, "youssef", 30000, SplitMethod.EQUAL,
                equal("youssef"), equal("ahmed"), equal("hamza")));

        assertEquals("boss", e.getUpdatedBy());
        assertEquals("youssef", e.getCreatedBy());
    }

    @Test
    void update_anotherOrdinaryMember_isForbidden() {
        existing("youssef", ExpenseStatus.ACTIVE);

        assertEquals(ErrorCode.FORBIDDEN, updateFailure("ahmed",
                update(3L, "youssef", 30000, SplitMethod.EQUAL, equal("youssef"))));
    }

    @Test
    void update_withAStaleVersion_isAConflict_andChangesNothing() {
        Expense e = existing("youssef", ExpenseStatus.ACTIVE);

        assertEquals(ErrorCode.VERSION_CONFLICT, updateFailure("youssef",
                update(2L, "youssef", 99999, SplitMethod.EQUAL, equal("youssef"))));

        assertEquals(30000L, e.getAmountMinor());
        assertEquals("Old title", e.getTitle());
    }

    @Test
    void update_aDeletedOrUnknownExpense_isNotFound() {
        existing("youssef", ExpenseStatus.DELETED);
        assertEquals(ErrorCode.NOT_FOUND, updateFailure("youssef",
                update(3L, "youssef", 1000, SplitMethod.EQUAL, equal("youssef"))));

        when(expenses.findByIdAndGroupId("e1", "g1")).thenReturn(Optional.empty());
        assertEquals(ErrorCode.NOT_FOUND, updateFailure("youssef",
                update(3L, "youssef", 1000, SplitMethod.EQUAL, equal("youssef"))));
    }

    @Test
    void update_withAnInvalidSplit_isRejected_andLeavesTheExpenseUntouched() {
        Expense e = existing("youssef", ExpenseStatus.ACTIVE);

        assertEquals(ErrorCode.INVALID_SPLIT, updateFailure("youssef", update(3L, "youssef", 30000,
                SplitMethod.CUSTOM, custom("youssef", 15000), custom("ahmed", 10000))));

        assertEquals(30000L, e.getAmountMinor());
        assertEquals(3, e.getShares().size());
        assertEquals("Old title", e.getTitle());
    }

    @Test
    void update_toAPayerWhoLeftTheGroup_isRejected() {
        existing("youssef", ExpenseStatus.ACTIVE);

        assertEquals(ErrorCode.PARTICIPANT_NOT_MEMBER, updateFailure("youssef",
                update(3L, "gone", 1000, SplitMethod.EQUAL, equal("youssef"))));
    }

    @Test
    void update_inAnArchivedGroup_isRejectedByTheGuard() {
        existing("youssef", ExpenseStatus.ACTIVE);
        when(guard.forWrite("g1", "youssef")).thenThrow(new ApiException(ErrorCode.GROUP_ARCHIVED, "archived"));

        assertEquals(ErrorCode.GROUP_ARCHIVED, updateFailure("youssef",
                update(3L, "youssef", 1000, SplitMethod.EQUAL, equal("youssef"))));
    }

    @Test
    void update_byAStranger_isNotFound_andNothingIsRead() {
        when(guard.forWrite("g1", "stranger")).thenThrow(new ApiException(ErrorCode.NOT_FOUND, "Group not found"));

        assertThrows(ApiException.class, () -> service.update("stranger", "g1", "e1",
                update(3L, "youssef", 1000, SplitMethod.EQUAL, equal("youssef"))));
        verifyNoInteractions(expenses, ledger, activity);
    }

    // ======================= delete =======================

    @Test
    void delete_theCreator_marksItDeleted_andKeepsTheDataForTheHistory() {
        Expense e = existing("youssef", ExpenseStatus.ACTIVE);

        service.delete("youssef", "g1", "e1");

        assertEquals(ExpenseStatus.DELETED, e.getStatus());
        assertEquals("youssef", e.getDeletedBy());
        assertEquals(NOW, e.getDeletedAt());
        assertEquals(30000L, e.getAmountMinor());
        assertEquals(3, e.getShares().size());
        verify(expenses).save(e);
        verify(expenses, never()).delete(any());
        verify(expenses, never()).deleteById(any());
        verify(ledger, times(1)).advance("g1");

        ArgumentCaptor<Map> before = ArgumentCaptor.forClass(Map.class);
        ArgumentCaptor<Map> after = ArgumentCaptor.forClass(Map.class);
        verify(activity).record(eq("g1"), eq("youssef"), eq(ActivityAction.EXPENSE_DELETED), eq("e1"),
                before.capture(), after.capture());
        assertEquals("ACTIVE", before.getValue().get("status"));
        assertEquals("DELETED", after.getValue().get("status"));
    }

    @Test
    void delete_theGroupOwner_mayRemoveSomeoneElsesExpense() {
        Expense e = existing("youssef", ExpenseStatus.ACTIVE);

        service.delete("boss", "g1", "e1");

        assertEquals(ExpenseStatus.DELETED, e.getStatus());
        assertEquals("boss", e.getDeletedBy());
    }

    @Test
    void delete_anotherOrdinaryMember_isForbidden() {
        Expense e = existing("youssef", ExpenseStatus.ACTIVE);

        assertEquals(ErrorCode.FORBIDDEN,
                assertThrows(ApiException.class, () -> service.delete("ahmed", "g1", "e1")).getCode());

        assertEquals(ExpenseStatus.ACTIVE, e.getStatus());
        verify(expenses, never()).save(any());
        verify(ledger, never()).advance(any());
    }

    @Test
    void delete_anAlreadyDeletedExpense_isNotFound_andNotLoggedTwice() {
        existing("youssef", ExpenseStatus.DELETED);

        assertEquals(ErrorCode.NOT_FOUND,
                assertThrows(ApiException.class, () -> service.delete("youssef", "g1", "e1")).getCode());
        verify(activity, never()).record(any(), any(), any(), any(), any(), any());
    }

    @Test
    void delete_byAStranger_isNotFound_andNothingIsRead() {
        when(guard.forWrite("g1", "stranger")).thenThrow(new ApiException(ErrorCode.NOT_FOUND, "Group not found"));

        assertThrows(ApiException.class, () -> service.delete("stranger", "g1", "e1"));
        verifyNoInteractions(expenses, ledger, activity);
    }
}
