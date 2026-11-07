package com.qisma.service.impl;

import com.qisma.dto.request.CreateInvitationRequest;
import com.qisma.dto.response.GroupResponse;
import com.qisma.dto.response.InvitationCreatedResponse;
import com.qisma.dto.response.InvitationPreviewResponse;
import com.qisma.dto.response.InvitationResponse;
import com.qisma.enums.GroupRole;
import com.qisma.enums.GroupStatus;
import com.qisma.enums.InvitationStatus;
import com.qisma.enums.InvitationType;
import com.qisma.enums.MembershipStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.mapper.GroupMapper;
import com.qisma.model.Group;
import com.qisma.model.Invitation;
import com.qisma.model.Membership;
import com.qisma.repository.GroupRepository;
import com.qisma.repository.InvitationStore;
import com.qisma.repository.MembershipRepository;
import com.qisma.security.AttemptLimiter;
import com.qisma.security.GroupAccessGuard;
import com.qisma.util.InvitationSecrets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DuplicateKeyException;


import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class InvitationServiceImplTest {

    private static final Instant NOW = Instant.parse("2026-11-07T12:00:00Z");
    private static final String CODE = "ABCD-2345";

    private InvitationStore invitations;
    private GroupRepository groups;
    private MembershipRepository memberships;
    private GroupAccessGuard guard;
    private InvitationServiceImpl service;
    private Group group;
    private Invitation invitation;

    @BeforeEach
    void setUp() {
        invitations = mock(InvitationStore.class);
        groups = mock(GroupRepository.class);
        memberships = mock(MembershipRepository.class);
        guard = mock(GroupAccessGuard.class);

        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        service = new InvitationServiceImpl(invitations, groups, memberships, guard,
                new GroupMapper(), new AttemptLimiter(clock), clock);

        group = new Group();
        group.setId("g1");
        group.setName("House");
        group.setCurrency("MAD");
        when(groups.findById("g1")).thenReturn(Optional.of(group));

        invitation = newInvitation(NOW.plus(Duration.ofDays(7)));
        String hash = InvitationSecrets.hash(CODE);
        when(invitations.findBySecretHash(hash)).thenReturn(Optional.of(invitation));
        when(invitations.claimUse(eq(hash), anyString(), any(Instant.class))).thenReturn(Optional.of(invitation));
        when(invitations.save(any(Invitation.class))).thenAnswer(inv -> inv.getArgument(0));
        when(memberships.findByGroupIdAndUserId("g1", "u1")).thenReturn(Optional.empty());
        when(memberships.save(any(Membership.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static Invitation newInvitation(Instant expiresAt) {
        return new Invitation("g1", "owner", InvitationType.CODE, InvitationSecrets.hash(CODE),
                1, NOW.minusSeconds(60), expiresAt);
    }

    private ErrorCode codeOf(Runnable action) {
        return assertThrows(ApiException.class, action::run).getCode();
    }

    // ---------- create ----------

    @Test
    void create_code_returnsTheSecretOnce_andStoresOnlyItsHash() {

        InvitationCreatedResponse r = service.create("owner", "g1", new CreateInvitationRequest(InvitationType.CODE, null, null));

        ArgumentCaptor<Invitation> saved = ArgumentCaptor.forClass(Invitation.class);
        verify(invitations).save(saved.capture());
        assertTrue(r.secret().matches("[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}"));
        assertEquals(InvitationSecrets.hash(r.secret()), saved.getValue().getSecretHash());
        assertNotEquals(r.secret(), saved.getValue().getSecretHash());
        assertEquals(1, saved.getValue().getMaxUses());
        assertEquals(NOW.plus(Duration.ofDays(7)), saved.getValue().getExpiresAt());
        verify(guard).forOwner("g1", "owner");
    }

    @Test
    void create_link_usesALongTokenAndDefaultsToTenUses() {
        InvitationCreatedResponse r = service.create("owner", "g1", new CreateInvitationRequest(InvitationType.LINK, 3, null));

        assertTrue(r.secret().length() >= 40);
        assertEquals(10, r.maxUses());
        assertEquals(NOW.plus(Duration.ofDays(3)), r.expiresAt());
    }

    @Test
    void create_byANonOwner_isRejected_andSavesNothing() {
        when(guard.forOwner("g1", "member")).thenThrow(new ApiException(ErrorCode.FORBIDDEN, "no"));

        assertEquals(ErrorCode.FORBIDDEN, codeOf(() ->
                service.create("member", "g1", new CreateInvitationRequest(InvitationType.CODE, null, null))));
        verify(invitations, never()).save(any());
    }

    // ---------- accept ----------


    @Test
    void accept_newMember_joinsAsAnOrdinaryMember() {
        GroupResponse r = service.accept("u1", CODE);

        ArgumentCaptor<Membership> saved = ArgumentCaptor.forClass(Membership.class);
        verify(memberships).save(saved.capture());
        assertEquals("g1", saved.getValue().getGroupId());
        assertEquals("u1", saved.getValue().getUserId());
        assertEquals(GroupRole.MEMBER, saved.getValue().getRole());
        assertEquals(NOW, saved.getValue().getJoinedAt());
        assertEquals(GroupRole.MEMBER, r.myRole());
    }

    @Test
    void accept_formerMember_getsTheSameMembershipBack() {
        Membership old = new Membership("g1", "u1", GroupRole.MEMBER, NOW.minus(Duration.ofDays(30)));
        old.setStatus(MembershipStatus.INACTIVE);
        old.setLeftAt(NOW.minus(Duration.ofDays(5)));
        when(memberships.findByGroupIdAndUserId("g1", "u1")).thenReturn(Optional.of(old));

        service.accept("u1", CODE);

        verify(memberships).save(old);
        assertEquals(MembershipStatus.ACTIVE, old.getStatus());
        assertNull(old.getLeftAt());
        assertEquals(NOW.minus(Duration.ofDays(30)), old.getJoinedAt());
    }

    @Test
    void accept_alreadyActiveMember_isRejected_withoutConsumingAUse() {
        when(memberships.findByGroupIdAndUserId("g1", "u1"))
                .thenReturn(Optional.of(new Membership("g1", "u1", GroupRole.OWNER, NOW)));


        assertEquals(ErrorCode.ALREADY_MEMBER, codeOf(() -> service.accept("u1", CODE)));
        verify(invitations, never()).claimUse(anyString(), anyString(), any());
    }

    @Test
    void accept_fullGroup_isRejected_withoutConsumingAUse() {
        when(memberships.countByGroupIdAndStatus("g1", MembershipStatus.ACTIVE))
                .thenReturn((long) InvitationServiceImpl.MAX_MEMBERS_PER_GROUP);

        assertEquals(ErrorCode.LIMIT_REACHED, codeOf(() -> service.accept("u1", CODE)));
        verify(invitations, never()).claimUse(anyString(), anyString(), any());
    }

    @Test
    void accept_userAtTheGroupLimit_isRejected() {
        when(memberships.countByUserIdAndStatus("u1", MembershipStatus.ACTIVE))
                .thenReturn((long) InvitationServiceImpl.MAX_GROUPS_PER_USER);

        assertEquals(ErrorCode.LIMIT_REACHED, codeOf(() -> service.accept("u1", CODE)));
        verify(memberships, never()).save(any());
    }

    @Test
    void accept_unknownSecret_isRejected() {
        assertEquals(ErrorCode.INVITATION_INVALID, codeOf(() -> service.accept("u1", "ZZZZ-9999")));
    }

    @Test
    void accept_expiredInvitation_isRejected() {
        Invitation expired = newInvitation(NOW.minusSeconds(1));
        when(invitations.findBySecretHash(InvitationSecrets.hash(CODE))).thenReturn(Optional.of(expired));


        assertEquals(ErrorCode.INVITATION_INVALID, codeOf(() -> service.accept("u1", CODE)));
    }

    @Test
    void accept_revokedInvitation_isRejected() {
        invitation.setStatus(InvitationStatus.REVOKED);
        assertEquals(ErrorCode.INVITATION_INVALID, codeOf(() -> service.accept("u1", CODE)));
    }

    @Test
    void accept_lostRace_isRejected_andCreatesNoMembership() {
        when(invitations.claimUse(anyString(), anyString(), any(Instant.class))).thenReturn(Optional.empty());

        assertEquals(ErrorCode.INVITATION_INVALID, codeOf(() -> service.accept("u1", CODE)));
        verify(memberships, never()).save(any());
    }

    @Test
    void accept_membershipFailure_givesTheUseBack() {
        when(memberships.save(any(Membership.class))).thenThrow(new DuplicateKeyException("dup"));

        assertEquals(ErrorCode.ALREADY_MEMBER, codeOf(() -> service.accept("u1", CODE)));
        verify(invitations).releaseUse(any(), eq("u1"));
    }

    @Test
    void accept_archivedGroup_isRejected() {
        group.setStatus(GroupStatus.ARCHIVED);
        assertEquals(ErrorCode.INVITATION_INVALID, codeOf(() -> service.accept("u1", CODE)));
    }


    @Test
    void accept_code_isCaseAndDashInsensitive() {
        assertDoesNotThrow(() -> service.accept("u1", "abcd2345"));
    }

    @Test
    void accept_tooManyWrongGuesses_areThrottled() {
        for (int i = 0; i < AttemptLimiter.MAX_FAILURES; i++) {
            assertEquals(ErrorCode.INVITATION_INVALID, codeOf(() -> service.accept("u1", "ZZZZ-9999")));
        }
        assertEquals(ErrorCode.TOO_MANY_ATTEMPTS, codeOf(() -> service.accept("u1", "ZZZZ-9999")));
        // even the right code is refused while throttled
        assertEquals(ErrorCode.TOO_MANY_ATTEMPTS, codeOf(() -> service.accept("u1", CODE)));
    }

    // ---------- preview ----------

    @Test
    void preview_showsTheGroup_withoutConsumingAUse() {
        InvitationPreviewResponse r = service.preview("u1", CODE);

        assertEquals("House", r.groupName());
        assertEquals("MAD", r.currency());
        verify(invitations, never()).claimUse(anyString(), anyString(), any());
    }

    // ---------- revoke / list ----------

    @Test
    void revoke_pending_succeeds() {
        when(invitations.revokePending("i1", "g1", NOW)).thenReturn(true);
        assertDoesNotThrow(() -> service.revoke("owner", "g1", "i1"));

        verify(guard).forOwner("g1", "owner");
    }

    @Test
    void revoke_unknownInvitation_isNotFound() {
        assertEquals(ErrorCode.NOT_FOUND, codeOf(() -> service.revoke("owner", "g1", "zzz")));
    }

    @Test
    void revoke_nonPendingInvitation_isAConflict() {
        when(invitations.findById("i1")).thenReturn(Optional.of(invitation));
        assertEquals(ErrorCode.INVITATION_NOT_PENDING, codeOf(() -> service.revoke("owner", "g1", "i1")));
    }

    @Test
    void list_marksExpiredPendingInvitations_andNeverExposesSecrets() {
        Invitation expired = newInvitation(NOW.minusSeconds(1));
        when(invitations.findByGroupId("g1")).thenReturn(List.of(expired, invitation));

        List<InvitationResponse> r = service.list("owner", "g1");

        assertEquals(InvitationStatus.EXPIRED, r.get(0).status());
        assertEquals(InvitationStatus.PENDING, r.get(1).status());
        for (var component : InvitationResponse.class.getRecordComponents()) {
            assertFalse(component.getName().toLowerCase().contains("secret"), component.getName());
        }
    }
}
