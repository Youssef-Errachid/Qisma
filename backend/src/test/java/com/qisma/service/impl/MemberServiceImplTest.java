package com.qisma.service.impl;

import com.qisma.dto.response.MemberResponse;
import com.qisma.enums.GroupRole;
import com.qisma.enums.MembershipStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.model.Membership;
import com.qisma.model.User;
import com.qisma.repository.MembershipRepository;
import com.qisma.repository.UserRepository;
import com.qisma.security.GroupAccessGuard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class MemberServiceImplTest {

    private static final Instant T0 = Instant.parse("2026-11-01T10:00:00Z");

    private MembershipRepository memberships;
    private UserRepository users;
    private GroupAccessGuard guard;

    private MemberServiceImpl service;

    @BeforeEach
    void setUp() {
        memberships = mock(MembershipRepository.class);
        users = mock(UserRepository.class);
        guard = mock(GroupAccessGuard.class);
        service = new MemberServiceImpl(memberships, users, guard);
    }

    private static User user(String id, String username, String fullName) {
        User u = new User();
        u.setId(id);
        u.setUsername(username);
        u.setFullName(fullName);
        u.setEmail(username + "@secret.com");
        return u;
    }

    private static Membership membership(String userId, GroupRole role, Instant joinedAt, MembershipStatus status) {
        Membership m = new Membership("g1", userId, role, joinedAt);
        m.setStatus(status);
        return m;
    }

    @Test
    void list_putsTheOwnerFirst_thenOrdersByJoinDate() {
        when(memberships.findByGroupId("g1")).thenReturn(List.of(
                membership("late", GroupRole.MEMBER, T0.plusSeconds(500), MembershipStatus.ACTIVE),
                membership("early", GroupRole.MEMBER, T0.plusSeconds(100), MembershipStatus.ACTIVE),
                membership("boss", GroupRole.OWNER, T0.plusSeconds(900), MembershipStatus.ACTIVE)));
        when(users.findAllById(any())).thenReturn(List.of(

                user("late", "l", "Late"), user("early", "e", "Early"), user("boss", "b", "Boss")));

        List<MemberResponse> r = service.list("boss", "g1", null);

        assertEquals(List.of("boss", "early", "late"), r.stream().map(MemberResponse::userId).toList());
        assertEquals("Boss", r.get(0).fullName());
    }

    @Test
    void list_includesInactiveMembers_unlessFiltered() {
        Membership gone = membership("gone", GroupRole.MEMBER, T0, MembershipStatus.INACTIVE);
        Membership here = membership("here", GroupRole.MEMBER, T0.plusSeconds(1), MembershipStatus.ACTIVE);
        when(memberships.findByGroupId("g1")).thenReturn(List.of(gone, here));
        when(memberships.findByGroupIdAndStatus("g1", MembershipStatus.ACTIVE)).thenReturn(List.of(here));
        when(users.findAllById(any())).thenReturn(List.of(user("gone", "g", "Gone"), user("here", "h", "Here")));

        assertEquals(2, service.list("here", "g1", null).size());
        List<MemberResponse> onlyActive = service.list("here", "g1", MembershipStatus.ACTIVE);
        assertEquals(1, onlyActive.size());
        assertEquals(MembershipStatus.ACTIVE, onlyActive.get(0).status());
    }

    @Test
    void list_neverExposesEmailAddresses() {
        for (var component : MemberResponse.class.getRecordComponents()) {
            assertFalse(component.getName().toLowerCase().contains("email"), component.getName());
        }
    }

    @Test
    void list_missingUser_doesNotBreakTheList() {
        when(memberships.findByGroupId("g1")).thenReturn(List.of(

                membership("ghost", GroupRole.MEMBER, T0, MembershipStatus.INACTIVE)));
        when(users.findAllById(any())).thenReturn(List.of());

        List<MemberResponse> r = service.list("someone", "g1", null);

        assertEquals(MemberServiceImpl.UNKNOWN_USER, r.get(0).fullName());
    }

    @Test
    void list_nonMember_isRejectedByTheGuard_andNothingIsRead() {
        when(guard.forRead("g1", "stranger")).thenThrow(new ApiException(ErrorCode.NOT_FOUND, "Group not found"));

        assertEquals(ErrorCode.NOT_FOUND,
                assertThrows(ApiException.class, () -> service.list("stranger", "g1", null)).getCode());
        verifyNoInteractions(users);
        verify(memberships, never()).findByGroupId(any());
    }
}
