package com.qisma.service.impl;

import com.qisma.dto.request.CreateSettlementRequest;
import com.qisma.dto.response.SettlementResponse;
import com.qisma.enums.ActivityAction;
import com.qisma.enums.GroupRole;
import com.qisma.enums.MembershipStatus;
import com.qisma.enums.SettlementStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.mapper.SettlementMapper;
import com.qisma.model.Group;
import com.qisma.model.Membership;
import com.qisma.model.Settlement;
import com.qisma.model.User;
import com.qisma.repository.GroupLedgerStore;
import com.qisma.repository.MembershipRepository;
import com.qisma.repository.SettlementRepository;
import com.qisma.repository.SettlementTransitionStore;
import com.qisma.repository.UserRepository;
import com.qisma.security.GroupAccessGuard;
import com.qisma.service.ActivityLogService;
import com.qisma.service.GroupLedger;
import com.qisma.service.LedgerService;
import com.qisma.service.SettlementResult;
import com.qisma.service.finance.MemberBalance;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

@SuppressWarnings({"unchecked", "rawtypes"})
class SettlementCommandServiceImplTest {

    private static final Instant NOW = Instant.parse("2026-11-07T12:00:00Z");
    private static final String KEY = "key-0001-abcdef";

    private SettlementRepository settlements;
    private MembershipRepository memberships;
    private SettlementTransitionStore transitions;
    private GroupAccessGuard guard;
    private LedgerService ledgerService;
    private GroupLedgerStore ledger;
    private ActivityLogService activity;
    private UserRepository users;
    private SettlementCommandServiceImpl service;

    @BeforeEach
    void setUp() {
        settlements = mock(SettlementRepository.class);
        memberships = mock(MembershipRepository.class);
        transitions = mock(SettlementTransitionStore.class);
        guard = mock(GroupAccessGuard.class);
        ledgerService = mock(LedgerService.class);
        ledger = mock(GroupLedgerStore.class);
        activity = mock(ActivityLogService.class);
        users = mock(UserRepository.class);
        service = new SettlementCommandServiceImpl(settlements, memberships, transitions, guard, ledgerService,
                ledger, activity, new SettlementMapper(users), Clock.fixed(NOW, ZoneOffset.UTC),
                mock(PlatformTransactionManager.class));

        Group group = new Group();
        group.setId("g1");
        group.setCurrency("MAD");
        for (String id : List.of("youssef", "ahmed", "hamza")) {
            GroupRole role = id.equals("youssef") ? GroupRole.OWNER : GroupRole.MEMBER;
            when(guard.forSettle("g1", id)).thenReturn(new GroupAccessGuard.Access(group,
                    new Membership("g1", id, role, NOW)));
            when(memberships.findByGroupIdAndUserId("g1", id))
                    .thenReturn(Optional.of(new Membership("g1", id, role, NOW)));
        }
        when(users.findAllById(any())).thenReturn(List.of(user("youssef"), user("ahmed"), user("hamza")));

        // the baseline of the dev group: youssef +116.66, ahmed -253.33, hamza +136.67
        stateOf(Map.of("youssef", 11666L, "ahmed", -25333L, "hamza", 13667L), Map.of(), Map.of());

        when(settlements.save(any(Settlement.class))).thenAnswer(inv -> {
            Settlement s = inv.getArgument(0);
            s.setId("s1");
            return s;
        });
    }

    private static User user(String id) {
        User u = new User();
        u.setId(id);
        u.setUsername(id);
        return u;
    }

    private void stateOf(Map<String, Long> nets, Map<String, Long> pendingOut, Map<String, Long> pendingIn) {
        Map<String, MemberBalance> balances = new HashMap<>();
        nets.forEach((id, net) -> balances.put(id, new MemberBalance(id, Math.max(net, 0L), Math.max(-net, 0L), 0L, 0L)));
        when(ledgerService.load("g1")).thenReturn(new GroupLedger(List.of(), balances, pendingOut, pendingIn));
    }

    private static CreateSettlementRequest request(String to, long amount) {
        return new CreateSettlementRequest(to, amount, null);
    }

    private ErrorCode createFailure(String actor, CreateSettlementRequest request) {
        ErrorCode code = assertThrows(ApiException.class,
                () -> service.create(actor, "g1", null, request)).getCode();
        verify(settlements, never()).save(any());
        verify(activity, never()).record(any(), any(), any(), any(), any(), any());
        return code;
    }

    private static Settlement pending(String from, String to, long amount) {
        Settlement s = new Settlement();
        s.setId("s1");
        s.setGroupId("g1");
        s.setFromUserId(from);
        s.setToUserId(to);
        s.setAmountMinor(amount);
        s.setCurrency("MAD");
        s.setStatus(SettlementStatus.PENDING);
        s.setCreatedAt(NOW);
        return s;
    }

    private Settlement stored(SettlementStatus status) {
        Settlement s = pending("ahmed", "youssef", 5000);
        s.setStatus(status);
        when(settlements.findByIdAndGroupId("s1", "g1")).thenReturn(Optional.of(s));
        return s;
    }

    // ============================== create ==============================

    @Test
    void create_savesAPendingSettlement_fromTheAuthenticatedUser() {
        SettlementResult r = service.create("ahmed", "g1", null, new CreateSettlementRequest("youssef", 5000L, "  cash  "));

        ArgumentCaptor<Settlement> saved = ArgumentCaptor.forClass(Settlement.class);
        verify(settlements).save(saved.capture());
        assertEquals("ahmed", saved.getValue().getFromUserId());
        assertEquals("youssef", saved.getValue().getToUserId());
        assertEquals(5000L, saved.getValue().getAmountMinor());
        assertEquals("MAD", saved.getValue().getCurrency());
        assertEquals("cash", saved.getValue().getNote());
        assertEquals(SettlementStatus.PENDING, saved.getValue().getStatus());
        assertEquals(NOW, saved.getValue().getCreatedAt());
        assertTrue(r.created());
        assertEquals("s1", r.response().id());
    }

    @Test
    void create_takesTheGroupLockBeforeReadingTheBalances_andAdvancesTheLedgerOnce() {
        service.create("ahmed", "g1", null, request("youssef", 5000));

        InOrder order = inOrder(ledger, ledgerService);
        order.verify(ledger).advance("g1");
        order.verify(ledgerService).load("g1");
        verify(ledger, times(1)).advance("g1");
    }

    @Test
    void create_recordsTheCreationInTheHistory_withoutAnOldValue() {
        service.create("ahmed", "g1", null, request("youssef", 5000));

        ArgumentCaptor<Map> after = ArgumentCaptor.forClass(Map.class);
        verify(activity).record(eq("g1"), eq("ahmed"), eq(ActivityAction.SETTLEMENT_CREATED), eq("s1"),
                isNull(), after.capture());
        assertEquals(5000L, after.getValue().get("amountMinor"));
        assertEquals("PENDING", after.getValue().get("status"));
    }

    @Test
    void create_theWholeDebt_isAllowed() {
        // ahmed owes exactly 253.33 and hamza is owed 136.67: pay hamza everything he is owed
        assertDoesNotThrow(() -> service.create("ahmed", "g1", null, request("hamza", 13667)));
    }

    @Test
    void create_moreThanTheSenderOwes_isRejected() {
        stateOf(Map.of("youssef", 11666L, "ahmed", -1000L, "hamza", 13667L), Map.of(), Map.of());
        assertEquals(ErrorCode.SETTLEMENT_EXCEEDS_BALANCE, createFailure("ahmed", request("hamza", 1001)));
        assertDoesNotThrow(() -> service.create("ahmed", "g1", null, request("hamza", 1000)));
    }

    @Test
    void create_moreThanTheRecipientIsOwed_isRejected() {
        assertEquals(ErrorCode.SETTLEMENT_EXCEEDS_BALANCE, createFailure("ahmed", request("youssef", 11667)));
    }

    @Test
    void create_bySomeoneWhoOwesNothing_isRejected() {
        assertEquals(ErrorCode.SETTLEMENT_EXCEEDS_BALANCE, createFailure("youssef", request("hamza", 1)));
    }

    @Test
    void create_whatIsAlreadyPendingCountsAgainstTheSender() {
        // 240.00 already pending from ahmed: only 13.33 of his debt is still free
        stateOf(Map.of("youssef", 11666L, "ahmed", -25333L, "hamza", 13667L),
                Map.of("ahmed", 24000L), Map.of("hamza", 24000L));

        assertEquals(ErrorCode.SETTLEMENT_EXCEEDS_BALANCE, createFailure("ahmed", request("youssef", 1334)));
        assertDoesNotThrow(() -> service.create("ahmed", "g1", null, request("youssef", 1333)));
    }

    @Test
    void create_whatIsAlreadyPendingCountsAgainstTheRecipient() {
        // youssef is owed 116.66 but 100.00 of it is already on its way
        stateOf(Map.of("youssef", 11666L, "ahmed", -25333L, "hamza", 13667L),
                Map.of("ahmed", 10000L), Map.of("youssef", 10000L));

        assertEquals(ErrorCode.SETTLEMENT_EXCEEDS_BALANCE, createFailure("ahmed", request("youssef", 1667)));
        assertDoesNotThrow(() -> service.create("ahmed", "g1", null, request("youssef", 1666)));
    }

    @Test
    void create_toYourself_isRejected() {
        assertEquals(ErrorCode.VALIDATION_FAILED, createFailure("ahmed", request("ahmed", 100)));
    }

    @Test
    void create_toSomeoneOutsideTheGroup_isRejected() {
        when(memberships.findByGroupIdAndUserId("g1", "outsider")).thenReturn(Optional.empty());
        assertEquals(ErrorCode.PARTICIPANT_NOT_MEMBER, createFailure("ahmed", request("outsider", 100)));
    }

    @Test
    void create_toAMemberWhoLeft_isAllowed() {
        Membership gone = new Membership("g1", "hamza", GroupRole.MEMBER, NOW);
        gone.setStatus(MembershipStatus.INACTIVE);
        when(memberships.findByGroupIdAndUserId("g1", "hamza")).thenReturn(Optional.of(gone));

        assertDoesNotThrow(() -> service.create("ahmed", "g1", null, request("hamza", 100)));
    }

    @Test
    void create_byANonMember_isRejectedByTheGuard_andNothingIsTouched() {
        when(guard.forSettle("g1", "stranger")).thenThrow(new ApiException(ErrorCode.NOT_FOUND, "Group not found"));

        assertThrows(ApiException.class, () -> service.create("stranger", "g1", null, request("youssef", 100)));
        verifyNoInteractions(settlements, ledger, ledgerService, activity, transitions);
    }

    @Test
    void create_withABlankNote_storesNothing() {
        service.create("ahmed", "g1", null, new CreateSettlementRequest("youssef", 100L, "   "));

        ArgumentCaptor<Settlement> saved = ArgumentCaptor.forClass(Settlement.class);
        verify(settlements).save(saved.capture());
        assertNull(saved.getValue().getNote());
    }

    // ---------------- idempotency ----------------

    @Test
    void create_withAnInvalidIdempotencyKey_isRejected() {
        for (String bad : List.of("short", "has spaces in it", "x".repeat(65), "bad/key/chars!")) {
            assertEquals(ErrorCode.VALIDATION_FAILED, assertThrows(ApiException.class,
                    () -> service.create("ahmed", "g1", bad, request("youssef", 100))).getCode(), bad);
        }
        verify(settlements, never()).save(any());
    }

    @Test
    void create_withANewKey_storesTheKey() {
        service.create("ahmed", "g1", "  " + KEY + "  ", request("youssef", 100));

        ArgumentCaptor<Settlement> saved = ArgumentCaptor.forClass(Settlement.class);
        verify(settlements).save(saved.capture());
        assertEquals(KEY, saved.getValue().getIdempotencyKey());
    }

    @Test
    void create_replayingTheSameRequest_returnsTheExistingSettlement_withoutCreatingAnother() {
        Settlement existing = pending("ahmed", "youssef", 5000);
        when(settlements.findByFromUserIdAndIdempotencyKey("ahmed", KEY)).thenReturn(Optional.of(existing));

        SettlementResult r = service.create("ahmed", "g1", KEY, request("youssef", 5000));

        assertFalse(r.created());
        assertEquals("s1", r.response().id());
        verify(settlements, never()).save(any());
        verify(ledger, never()).advance(any());
    }

    @Test
    void create_theSameKeyForADifferentRequest_isAConflict() {
        when(settlements.findByFromUserIdAndIdempotencyKey("ahmed", KEY))
                .thenReturn(Optional.of(pending("ahmed", "youssef", 5000)));

        assertEquals(ErrorCode.IDEMPOTENCY_KEY_REUSED, assertThrows(ApiException.class,
                () -> service.create("ahmed", "g1", KEY, request("youssef", 6000))).getCode());
        assertEquals(ErrorCode.IDEMPOTENCY_KEY_REUSED, assertThrows(ApiException.class,
                () -> service.create("ahmed", "g1", KEY, request("hamza", 5000))).getCode());
    }

    @Test
    void create_losingARaceOnTheKey_returnsTheWinner() {
        Settlement winner = pending("ahmed", "youssef", 5000);
        when(settlements.findByFromUserIdAndIdempotencyKey("ahmed", KEY))
                .thenReturn(Optional.empty(), Optional.of(winner));
        when(settlements.save(any(Settlement.class))).thenThrow(new DuplicateKeyException("uk_settlements_from_idempotencyKey"));

        SettlementResult r = service.create("ahmed", "g1", KEY, request("youssef", 5000));

        assertFalse(r.created());
        assertEquals("s1", r.response().id());
    }

    @Test
    void create_aDuplicateKeyWithoutAnIdempotencyKey_isNotHidden() {
        when(settlements.save(any(Settlement.class))).thenThrow(new DuplicateKeyException("something else"));

        assertThrows(DuplicateKeyException.class, () -> service.create("ahmed", "g1", null, request("youssef", 100)));
    }

    // ============================== confirm ==============================

    @Test
    void confirm_theReceiver_confirmsAtomically_andRecordsBeforeAndAfter() {
        stored(SettlementStatus.PENDING);
        Settlement confirmed = pending("ahmed", "youssef", 5000);
        confirmed.setStatus(SettlementStatus.CONFIRMED);
        confirmed.setConfirmedAt(NOW);
        when(transitions.markConfirmed("s1", "g1", "youssef", NOW)).thenReturn(Optional.of(confirmed));

        SettlementResponse r = service.confirm("youssef", "g1", "s1");

        assertEquals(SettlementStatus.CONFIRMED, r.status());
        verify(ledger, times(1)).advance("g1");
        ArgumentCaptor<Map> before = ArgumentCaptor.forClass(Map.class);
        ArgumentCaptor<Map> after = ArgumentCaptor.forClass(Map.class);
        verify(activity).record(eq("g1"), eq("youssef"), eq(ActivityAction.SETTLEMENT_CONFIRMED), eq("s1"),
                before.capture(), after.capture());
        assertEquals("PENDING", before.getValue().get("status"));
        assertEquals("CONFIRMED", after.getValue().get("status"));
    }

    @Test
    void confirm_theSender_cannotConfirmOwnSettlement() {
        stored(SettlementStatus.PENDING);

        assertEquals(ErrorCode.FORBIDDEN,
                assertThrows(ApiException.class, () -> service.confirm("ahmed", "g1", "s1")).getCode());
        verifyNoInteractions(transitions);
        verify(ledger, never()).advance(any());
    }

    @Test
    void confirm_nobodyElse_not_evenTheGroupOwner_canConfirmInPlaceOfTheReceiver() {
        Settlement s = pending("ahmed", "hamza", 5000);
        when(settlements.findByIdAndGroupId("s1", "g1")).thenReturn(Optional.of(s));

        // youssef is the OWNER of the group, but hamza is the receiver (BR-13)
        assertEquals(ErrorCode.FORBIDDEN,
                assertThrows(ApiException.class, () -> service.confirm("youssef", "g1", "s1")).getCode());
        verifyNoInteractions(transitions);
    }

    @Test
    void confirm_anAlreadyConfirmedSettlement_isRefused_soItCanNeverCountTwice() {
        stored(SettlementStatus.CONFIRMED);

        assertEquals(ErrorCode.SETTLEMENT_NOT_PENDING,
                assertThrows(ApiException.class, () -> service.confirm("youssef", "g1", "s1")).getCode());
        verifyNoInteractions(transitions);
        verify(activity, never()).record(any(), any(), any(), any(), any(), any());
    }

    @Test
    void confirm_losingTheRace_isRefused_andNothingIsRecorded() {
        stored(SettlementStatus.PENDING);
        when(transitions.markConfirmed(any(), any(), any(), any())).thenReturn(Optional.empty());

        assertEquals(ErrorCode.SETTLEMENT_NOT_PENDING,
                assertThrows(ApiException.class, () -> service.confirm("youssef", "g1", "s1")).getCode());
        verify(activity, never()).record(any(), any(), any(), any(), any(), any());
    }

    @Test
    void confirm_anUnknownSettlement_isNotFound() {
        when(settlements.findByIdAndGroupId("nope", "g1")).thenReturn(Optional.empty());

        assertEquals(ErrorCode.NOT_FOUND,
                assertThrows(ApiException.class, () -> service.confirm("youssef", "g1", "nope")).getCode());
    }

    @Test
    void confirm_byANonMember_isRejectedByTheGuard() {
        when(guard.forSettle("g1", "stranger")).thenThrow(new ApiException(ErrorCode.NOT_FOUND, "Group not found"));

        assertThrows(ApiException.class, () -> service.confirm("stranger", "g1", "s1"));
        verifyNoInteractions(settlements, transitions, ledger);
    }

    // ============================== reject ==============================

    @Test
    void reject_theReceiver_rejectsWithATrimmedReason() {
        stored(SettlementStatus.PENDING);
        Settlement rejected = pending("ahmed", "youssef", 5000);
        rejected.setStatus(SettlementStatus.REJECTED);
        rejected.setRejectionReason("not received");
        when(transitions.markRejected("s1", "g1", "youssef", "not received", NOW)).thenReturn(Optional.of(rejected));

        SettlementResponse r = service.reject("youssef", "g1", "s1", "  not received  ");

        assertEquals(SettlementStatus.REJECTED, r.status());
        assertEquals("not received", r.rejectionReason());
        verify(activity).record(eq("g1"), eq("youssef"), eq(ActivityAction.SETTLEMENT_REJECTED), eq("s1"), any(), any());
    }

    @Test
    void reject_withoutAReason_isAllowed() {
        stored(SettlementStatus.PENDING);
        Settlement rejected = pending("ahmed", "youssef", 5000);
        rejected.setStatus(SettlementStatus.REJECTED);
        when(transitions.markRejected("s1", "g1", "youssef", null, NOW)).thenReturn(Optional.of(rejected));

        assertDoesNotThrow(() -> service.reject("youssef", "g1", "s1", "   "));
    }

    @Test
    void reject_theSender_cannotRejectOwnSettlement() {
        stored(SettlementStatus.PENDING);

        assertEquals(ErrorCode.FORBIDDEN,
                assertThrows(ApiException.class, () -> service.reject("ahmed", "g1", "s1", null)).getCode());
        verifyNoInteractions(transitions);
    }

    @Test
    void reject_aSettlementThatWasCancelled_isRefused() {
        stored(SettlementStatus.CANCELLED);

        assertEquals(ErrorCode.SETTLEMENT_NOT_PENDING,
                assertThrows(ApiException.class, () -> service.reject("youssef", "g1", "s1", null)).getCode());
    }

    // ============================== cancel ==============================

    @Test
    void cancel_theSender_cancelsWhileItIsPending() {
        stored(SettlementStatus.PENDING);
        Settlement cancelled = pending("ahmed", "youssef", 5000);
        cancelled.setStatus(SettlementStatus.CANCELLED);
        when(transitions.markCancelled("s1", "g1", "ahmed", NOW)).thenReturn(Optional.of(cancelled));

        SettlementResponse r = service.cancel("ahmed", "g1", "s1");

        assertEquals(SettlementStatus.CANCELLED, r.status());
        verify(ledger, times(1)).advance("g1");
        verify(activity).record(eq("g1"), eq("ahmed"), eq(ActivityAction.SETTLEMENT_CANCELLED), eq("s1"), any(), any());
    }

    @Test
    void cancel_theReceiver_cannotCancel() {
        stored(SettlementStatus.PENDING);

        assertEquals(ErrorCode.FORBIDDEN,
                assertThrows(ApiException.class, () -> service.cancel("youssef", "g1", "s1")).getCode());
        verifyNoInteractions(transitions);
    }

    @Test
    void cancel_aConfirmedSettlement_isRefused_becauseTheMoneyAlreadyMoved() {
        stored(SettlementStatus.CONFIRMED);

        assertEquals(ErrorCode.SETTLEMENT_NOT_PENDING,
                assertThrows(ApiException.class, () -> service.cancel("ahmed", "g1", "s1")).getCode());
        verifyNoInteractions(transitions);
    }

    @Test
    void cancel_losingTheRaceToAConfirmation_isRefused() {
        stored(SettlementStatus.PENDING);
        when(transitions.markCancelled(any(), any(), any(), any())).thenReturn(Optional.empty());

        assertEquals(ErrorCode.SETTLEMENT_NOT_PENDING,
                assertThrows(ApiException.class, () -> service.cancel("ahmed", "g1", "s1")).getCode());
    }
}
