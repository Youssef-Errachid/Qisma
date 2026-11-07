package com.qisma.service.impl;

import com.qisma.dto.request.TransferOwnershipRequest;
import com.qisma.dto.request.UpdateGroupRequest;
import com.qisma.dto.response.GroupResponse;
import com.qisma.enums.ActivityAction;
import com.qisma.enums.GroupRole;
import com.qisma.enums.MembershipStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.mapper.GroupMapper;
import com.qisma.model.Group;
import com.qisma.model.Membership;
import com.qisma.repository.GroupLedgerStore;
import com.qisma.repository.GroupUpdateStore;
import com.qisma.repository.MembershipRepository;
import com.qisma.security.GroupAccessGuard;
import com.qisma.service.ActivityLogService;
import com.qisma.service.GroupLedger;
import com.qisma.service.LedgerService;
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
class GroupLifecycleServiceImplTest {

    private static final Instant NOW = Instant.parse("2026-11-07T12:00:00Z");

    private GroupUpdateStore store;
    private MembershipRepository memberships;
    private GroupAccessGuard guard;
    private LedgerService ledgerService;
    private GroupLedgerStore ledger;
    private ActivityLogService activity;
    private GroupLifecycleServiceImpl service;

    private Group group;
    private Membership owner;
    private Membership ahmed;
    private Membership hamza;

    @BeforeEach
    void setUp() {
        store = mock(GroupUpdateStore.class);
        memberships = mock(MembershipRepository.class);
        guard = mock(GroupAccessGuard.class);
        ledgerService = mock(LedgerService.class);
        ledger = mock(GroupLedgerStore.class);
        activity = mock(ActivityLogService.class);
        service = new GroupLifecycleServiceImpl(store, memberships, guard, ledgerService, ledger, activity,
                new GroupMapper(), Clock.fixed(NOW, ZoneOffset.UTC), mock(PlatformTransactionManager.class));

        group = new Group();
        group.setId("g1");
        group.setName("House");
        group.setCurrency("MAD");
        group.setOwnerId("youssef");

        owner = new Membership("g1", "youssef", GroupRole.OWNER, NOW);
        ahmed = new Membership("g1", "ahmed", GroupRole.MEMBER, NOW);
        hamza = new Membership("g1", "hamza", GroupRole.MEMBER, NOW);

        when(guard.forOwner("g1", "youssef")).thenReturn(new GroupAccessGuard.Access(group, owner));
        when(guard.forWrite("g1", "youssef")).thenReturn(new GroupAccessGuard.Access(group, owner));
        when(guard.forWrite("g1", "ahmed")).thenReturn(new GroupAccessGuard.Access(group, ahmed));
        when(guard.forWrite("g1", "hamza")).thenReturn(new GroupAccessGuard.Access(group, hamza));

        when(memberships.findByGroupIdAndUserId("g1", "youssef")).thenReturn(Optional.of(owner));
        when(memberships.findByGroupIdAndUserId("g1", "ahmed")).thenReturn(Optional.of(ahmed));
        when(memberships.findByGroupIdAndUserId("g1", "hamza")).thenReturn(Optional.of(hamza));

        // youssef is owed 30.00, hamza owes 30.00, ahmed is square
        stateOf(Map.of("youssef", 3000L, "ahmed", 0L, "hamza", -3000L), Map.of(), Map.of());

        when(ledger.advance("g1")).thenReturn(7L);
        when(store.archive(eq("g1"), any())).thenReturn(true);
    }

    private void stateOf(Map<String, Long> nets, Map<String, Long> pendingOut, Map<String, Long> pendingIn) {
        Map<String, MemberBalance> balances = new HashMap<>();
        nets.forEach((id, net) -> balances.put(id, new MemberBalance(id, Math.max(net, 0L), Math.max(-net, 0L), 0L, 0L)));
        when(ledgerService.load("g1")).thenReturn(new GroupLedger(List.of(), balances, pendingOut, pendingIn));
    }

    private static ApiException failure(Runnable action) {
        return assertThrows(ApiException.class, action::run);
    }

    // ============================== update ==============================

    @Test
    void update_renamesTheGroup_withoutTouchingTheLedger() {
        GroupResponse r = service.update("youssef", "g1", new UpdateGroupRequest("  New name ", "  about  ", null));

        verify(store).updateDetails("g1", "New name", "about", null);
        verify(ledger, never()).advance(any());
        assertEquals("New name", r.name());
        assertEquals("MAD", r.currency());
        assertEquals(GroupRole.OWNER, r.myRole());
    }

    @Test
    void update_recordsBeforeAndAfterInTheHistory() {
        service.update("youssef", "g1", new UpdateGroupRequest("New name", null, null));

        ArgumentCaptor<Map> before = ArgumentCaptor.forClass(Map.class);
        ArgumentCaptor<Map> after = ArgumentCaptor.forClass(Map.class);
        verify(activity).record(eq("g1"), eq("youssef"), eq(ActivityAction.GROUP_UPDATED), eq("g1"),
                before.capture(), after.capture());
        assertEquals("House", before.getValue().get("name"));
        assertEquals("New name", after.getValue().get("name"));
    }

    @Test
    void update_aBlankDescription_isStoredAsNothing() {
        service.update("youssef", "g1", new UpdateGroupRequest("House", "   ", null));
        verify(store).updateDetails("g1", "House", null, null);
    }

    @Test
    void update_theCurrency_canChangeOnAFreshGroup() {
        when(ledger.advance("g1")).thenReturn(1L);

        GroupResponse r = service.update("youssef", "g1", new UpdateGroupRequest("House", null, " eur "));

        verify(store).updateDetails("g1", "House", null, "EUR");
        assertEquals("EUR", r.currency());
    }

    @Test
    void update_theCurrency_isLockedOnceTheGroupHasHadAnyFinancialOperation() {
        when(ledger.advance("g1")).thenReturn(7L);

        ApiException e = failure(() -> service.update("youssef", "g1", new UpdateGroupRequest("House", null, "EUR")));

        assertEquals(ErrorCode.CURRENCY_LOCKED, e.getCode());
        verify(store, never()).updateDetails(any(), any(), any(), any());
        verify(activity, never()).record(any(), any(), any(), any(), any(), any());
    }

    @Test
    void update_theSameCurrencyInAnyCase_isNotAChange_andNeedsNoLock() {
        service.update("youssef", "g1", new UpdateGroupRequest("House", null, " mad "));

        verify(ledger, never()).advance(any());
        verify(store).updateDetails("g1", "House", null, null);
    }

    @Test
    void update_anUnknownOrNonMonetaryCurrency_isRejected() {
        for (String bad : List.of("ABC", "XXX")) {
            assertEquals(ErrorCode.VALIDATION_FAILED, failure(() ->
                    service.update("youssef", "g1", new UpdateGroupRequest("House", null, bad))).getCode(), bad);
        }
        verify(store, never()).updateDetails(any(), any(), any(), any());
    }

    @Test
    void update_byANonOwner_isRefusedByTheGuard_andNothingIsTouched() {
        when(guard.forOwner("g1", "ahmed")).thenThrow(new ApiException(ErrorCode.FORBIDDEN, "owner only"));

        assertEquals(ErrorCode.FORBIDDEN, failure(() ->
                service.update("ahmed", "g1", new UpdateGroupRequest("Hacked", null, null))).getCode());
        verifyNoInteractions(store, ledger, activity);
    }

    // ============================== archive ==============================

    @Test
    void archive_freezesTheGroup_evenWithBalancesStillOpen() {
        service.archive("youssef", "g1");

        verify(store).archive("g1", NOW);
        verify(activity).record(eq("g1"), eq("youssef"), eq(ActivityAction.GROUP_ARCHIVED), eq("g1"), any(), any());
    }

    @Test
    void archive_isRefusedWhileASettlementIsPending() {
        stateOf(Map.of("youssef", 3000L, "ahmed", 0L, "hamza", -3000L), Map.of("hamza", 1000L), Map.of("youssef", 1000L));

        assertEquals(ErrorCode.PENDING_SETTLEMENTS, failure(() -> service.archive("youssef", "g1")).getCode());
        verify(store, never()).archive(any(), any());
        verify(activity, never()).record(any(), any(), any(), any(), any(), any());
    }

    @Test
    void archive_takesTheGroupLockBeforeLookingAtTheLedger() {
        service.archive("youssef", "g1");

        InOrder order = inOrder(ledger, ledgerService);
        order.verify(ledger).advance("g1");
        order.verify(ledgerService).load("g1");
    }

    @Test
    void archive_whenSomeoneArchivedItFirst_isAConflict() {
        when(store.archive(eq("g1"), any())).thenReturn(false);

        assertEquals(ErrorCode.GROUP_ARCHIVED, failure(() -> service.archive("youssef", "g1")).getCode());
        verify(activity, never()).record(any(), any(), any(), any(), any(), any());
    }

    @Test
    void archive_byANonOwner_isRefused() {
        when(guard.forOwner("g1", "ahmed")).thenThrow(new ApiException(ErrorCode.FORBIDDEN, "owner only"));

        assertThrows(ApiException.class, () -> service.archive("ahmed", "g1"));
        verifyNoInteractions(store, ledger);
    }

    // ============================== leave ==============================

    @Test
    void leave_aMemberWithAZeroBalance_becomesInactive_andKeepsTheMembership() {
        service.leave("ahmed", "g1");

        assertEquals(MembershipStatus.INACTIVE, ahmed.getStatus());
        assertEquals(NOW, ahmed.getLeftAt());
        verify(memberships).save(ahmed);
        verify(activity).record(eq("g1"), eq("ahmed"), eq(ActivityAction.MEMBER_LEFT), eq("ahmed"), any(), any());
    }

    @Test
    void leave_takesTheGroupLockBeforeReadingTheBalances() {
        service.leave("ahmed", "g1");

        InOrder order = inOrder(ledger, ledgerService);
        order.verify(ledger).advance("g1");
        order.verify(ledgerService).load("g1");
    }

    @Test
    void leave_withAnOpenBalance_isRefused_andNothingChanges() {
        assertEquals(ErrorCode.BALANCE_NOT_SETTLED, failure(() -> service.leave("hamza", "g1")).getCode());

        assertEquals(MembershipStatus.ACTIVE, hamza.getStatus());
        verify(memberships, never()).save(any());
        verify(activity, never()).record(any(), any(), any(), any(), any(), any());
    }

    @Test
    void leave_withAPendingSettlement_isRefused_whicheverSideItIsOn() {
        stateOf(Map.of("youssef", 0L, "ahmed", 0L, "hamza", 0L), Map.of("ahmed", 100L), Map.of());
        assertEquals(ErrorCode.PENDING_SETTLEMENTS, failure(() -> service.leave("ahmed", "g1")).getCode());

        stateOf(Map.of("youssef", 0L, "ahmed", 0L, "hamza", 0L), Map.of(), Map.of("ahmed", 100L));
        assertEquals(ErrorCode.PENDING_SETTLEMENTS, failure(() -> service.leave("ahmed", "g1")).getCode());
        verify(memberships, never()).save(any());
    }

    @Test
    void leave_theOwner_mustTransferTheOwnershipFirst() {
        assertEquals(ErrorCode.OWNER_MUST_TRANSFER, failure(() -> service.leave("youssef", "g1")).getCode());
        verifyNoInteractions(ledger, ledgerService);
    }

    @Test
    void leave_whenAlreadyInactive_isRefusedByTheGuard() {
        when(guard.forWrite("g1", "ahmed")).thenThrow(new ApiException(ErrorCode.FORBIDDEN, "settle only"));

        assertEquals(ErrorCode.FORBIDDEN, failure(() -> service.leave("ahmed", "g1")).getCode());
    }

    @Test
    void leave_whenTheMembershipChangedMeanwhile_isRefused() {
        ahmed.setStatus(MembershipStatus.INACTIVE);

        assertEquals(ErrorCode.MEMBER_NOT_ACTIVE, failure(() -> service.leave("ahmed", "g1")).getCode());
        verify(memberships, never()).save(any());
    }

    // ============================== deactivate a member ==============================

    @Test
    void deactivate_aMemberWhoStillOwes_isAllowed_andStaysSettleOnly() {
        service.deactivateMember("youssef", "g1", "hamza");

        assertEquals(MembershipStatus.INACTIVE, hamza.getStatus());
        assertEquals(NOW, hamza.getLeftAt());
        verify(memberships).save(hamza);
        ArgumentCaptor<Map> after = ArgumentCaptor.forClass(Map.class);
        verify(activity).record(eq("g1"), eq("youssef"), eq(ActivityAction.MEMBER_DEACTIVATED), eq("hamza"),
                any(), after.capture());
        assertEquals(-3000L, after.getValue().get("balanceMinor"));
    }

    @Test
    void deactivate_aMemberWithAPendingSettlement_isRefused() {
        stateOf(Map.of("youssef", 3000L, "ahmed", 0L, "hamza", -3000L), Map.of("hamza", 500L), Map.of("youssef", 500L));

        assertEquals(ErrorCode.PENDING_SETTLEMENTS,
                failure(() -> service.deactivateMember("youssef", "g1", "hamza")).getCode());
        assertEquals(MembershipStatus.ACTIVE, hamza.getStatus());
        verify(memberships, never()).save(any());
    }

    @Test
    void deactivate_theOwnerHimself_isRefused() {
        assertEquals(ErrorCode.CANNOT_REMOVE_OWNER,
                failure(() -> service.deactivateMember("youssef", "g1", "youssef")).getCode());
        verifyNoInteractions(ledger);
    }

    @Test
    void deactivate_whoeverHoldsTheOwnerRole_isRefused() {
        Membership otherOwner = new Membership("g1", "boss", GroupRole.OWNER, NOW);
        when(memberships.findByGroupIdAndUserId("g1", "boss")).thenReturn(Optional.of(otherOwner));

        assertEquals(ErrorCode.CANNOT_REMOVE_OWNER,
                failure(() -> service.deactivateMember("youssef", "g1", "boss")).getCode());
        assertEquals(MembershipStatus.ACTIVE, otherOwner.getStatus());
    }

    @Test
    void deactivate_anUnknownMember_isNotFound() {
        when(memberships.findByGroupIdAndUserId("g1", "nobody")).thenReturn(Optional.empty());

        assertEquals(ErrorCode.NOT_FOUND, failure(() -> service.deactivateMember("youssef", "g1", "nobody")).getCode());
    }

    @Test
    void deactivate_aMemberAlreadyInactive_isRefused() {
        hamza.setStatus(MembershipStatus.INACTIVE);

        assertEquals(ErrorCode.MEMBER_NOT_ACTIVE,
                failure(() -> service.deactivateMember("youssef", "g1", "hamza")).getCode());
    }

    @Test
    void deactivate_byANonOwner_isRefused_andNothingIsTouched() {
        when(guard.forOwner("g1", "ahmed")).thenThrow(new ApiException(ErrorCode.FORBIDDEN, "owner only"));

        assertEquals(ErrorCode.FORBIDDEN, failure(() -> service.deactivateMember("ahmed", "g1", "hamza")).getCode());
        verifyNoInteractions(ledger, ledgerService);
        verify(memberships, never()).save(any());
    }

    // ============================== transfer ownership ==============================

    @Test
    void transfer_demotesTheOldOwnerFirst_thenPromotesTheNewOne() {
        GroupResponse r = service.transferOwnership("youssef", "g1", new TransferOwnershipRequest("ahmed"));

        InOrder order = inOrder(memberships, store);
        order.verify(memberships).save(owner);
        order.verify(memberships).save(ahmed);
        order.verify(store).setOwner("g1", "ahmed");
        assertEquals(GroupRole.MEMBER, owner.getRole());
        assertEquals(GroupRole.OWNER, ahmed.getRole());
        assertEquals("ahmed", r.ownerId());
        assertEquals(GroupRole.MEMBER, r.myRole());
        verify(activity).record(eq("g1"), eq("youssef"), eq(ActivityAction.OWNERSHIP_TRANSFERRED), eq("g1"), any(), any());
    }

    @Test
    void transfer_toYourself_isRefused() {
        assertEquals(ErrorCode.VALIDATION_FAILED,
                failure(() -> service.transferOwnership("youssef", "g1", new TransferOwnershipRequest("youssef"))).getCode());
        verifyNoInteractions(ledger);
    }

    @Test
    void transfer_toAMemberWhoLeft_orToSomeoneElse_isRefused() {
        hamza.setStatus(MembershipStatus.INACTIVE);
        when(memberships.findByGroupIdAndUserId("g1", "outsider")).thenReturn(Optional.empty());

        for (String target : List.of("hamza", "outsider")) {
            assertEquals(ErrorCode.PARTICIPANT_NOT_MEMBER, failure(() ->
                    service.transferOwnership("youssef", "g1", new TransferOwnershipRequest(target))).getCode(), target);
        }
        verify(memberships, never()).save(any());
        verify(store, never()).setOwner(any(), any());
        assertEquals(GroupRole.OWNER, owner.getRole());
    }

    @Test
    void transfer_losingARaceOnTheSingleOwnerIndex_isAConflict_notAServerError() {
        when(memberships.save(ahmed)).thenThrow(new DuplicateKeyException("uk_memberships_single_active_owner"));

        assertEquals(ErrorCode.CONCURRENT_UPDATE,
                failure(() -> service.transferOwnership("youssef", "g1", new TransferOwnershipRequest("ahmed"))).getCode());
        verify(store, never()).setOwner(any(), any());
    }

    @Test
    void transfer_byANonOwner_isRefused() {
        when(guard.forOwner("g1", "ahmed")).thenThrow(new ApiException(ErrorCode.FORBIDDEN, "owner only"));

        assertThrows(ApiException.class,
                () -> service.transferOwnership("ahmed", "g1", new TransferOwnershipRequest("hamza")));
        verifyNoInteractions(ledger, store);
    }

    @Test
    void transfer_takesTheGroupLockFirst_soItCannotRaceWithAMemberLeaving() {
        service.transferOwnership("youssef", "g1", new TransferOwnershipRequest("ahmed"));

        InOrder order = inOrder(ledger, memberships);
        order.verify(ledger).advance("g1");
        order.verify(memberships).save(owner);
    }

    @Test
    void everyOperationThatChangesMembership_advancesTheLedgerExactlyOnce() {
        service.leave("ahmed", "g1");
        verify(ledger, times(1)).advance("g1");

        clearInvocations(ledger);
        service.deactivateMember("youssef", "g1", "hamza");
        verify(ledger, times(1)).advance("g1");

        clearInvocations(ledger);
        service.archive("youssef", "g1");
        verify(ledger, times(1)).advance("g1");
        verify(activity, never()).record(any(), any(), eq(ActivityAction.GROUP_UPDATED), any(), isNull(), any());
    }
}
