package com.qisma.service.impl;

import com.qisma.dto.request.CreateGroupRequest;
import com.qisma.dto.response.GroupResponse;
import com.qisma.enums.GroupRole;
import com.qisma.enums.MembershipStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.mapper.GroupMapper;
import com.qisma.model.Group;
import com.qisma.model.Membership;
import com.qisma.repository.GroupRepository;
import com.qisma.repository.MembershipRepository;
import com.qisma.security.GroupAccessGuard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class GroupServiceImplTest {

    private static final Instant NOW = Instant.parse("2026-11-07T12:00:00Z");

    private GroupRepository groups;
    private MembershipRepository memberships;
    private GroupAccessGuard guard;
    private GroupServiceImpl service;

    @BeforeEach
    void setUp() {
        groups = mock(GroupRepository.class);
        memberships = mock(MembershipRepository.class);
        guard = mock(GroupAccessGuard.class);
        service = new GroupServiceImpl(groups, memberships, guard, new GroupMapper(),
                Clock.fixed(NOW, ZoneOffset.UTC));

        when(groups.save(any(Group.class))).thenAnswer(inv -> {
            Group g = inv.getArgument(0);
            g.setId("g1");
            return g;
        });
    }

    private static CreateGroupRequest request(String name, String description, String currency) {
        return new CreateGroupRequest(name, description, currency);
    }

    @Test
    void create_savesTheGroup_andMakesTheCreatorItsOwner() {
        GroupResponse r = service.create("u1", request("  House 2026 ", "  ", null));

        ArgumentCaptor<Group> savedGroup = ArgumentCaptor.forClass(Group.class);
        verify(groups).save(savedGroup.capture());
        assertEquals("House 2026", savedGroup.getValue().getName());
        assertNull(savedGroup.getValue().getDescription());
        assertEquals("u1", savedGroup.getValue().getOwnerId());
        assertEquals("MAD", savedGroup.getValue().getCurrency());

        ArgumentCaptor<Membership> savedMembership = ArgumentCaptor.forClass(Membership.class);
        verify(memberships).save(savedMembership.capture());
        assertEquals("g1", savedMembership.getValue().getGroupId());
        assertEquals("u1", savedMembership.getValue().getUserId());
        assertEquals(GroupRole.OWNER, savedMembership.getValue().getRole());
        assertEquals(NOW, savedMembership.getValue().getJoinedAt());

        assertEquals("g1", r.id());
        assertEquals(GroupRole.OWNER, r.myRole());
    }

    @Test
    void create_normalizesTheCurrencyCode() {
        assertEquals("EUR", service.create("u1", request("Trip", null, " eur ")).currency());
    }

    @Test
    void create_rejectsUnknownOrNonMonetaryCurrencies() {
        for (String bad : List.of("ABC", "XXX")) {
            ApiException e = assertThrows(ApiException.class,
                    () -> service.create("u1", request("Trip", null, bad)));
            assertEquals(ErrorCode.VALIDATION_FAILED, e.getCode(), bad);
        }
        verify(groups, never()).save(any());
    }

    @Test
    void create_rejectsWhenTheUserReachedTheGroupLimit() {
        when(memberships.countByUserIdAndStatus("u1", MembershipStatus.ACTIVE))
                .thenReturn((long) GroupServiceImpl.MAX_GROUPS_PER_USER);

        ApiException e = assertThrows(ApiException.class,
                () -> service.create("u1", request("One more", null, null)));

        assertEquals(ErrorCode.LIMIT_REACHED, e.getCode());
        verify(groups, never()).save(any());
        verify(memberships, never()).save(any());
    }

    @Test
    void listMine_returnsOnlyTheUsersGroups_withTheirRoles() {
        Group a = new Group();
        a.setId("ga");
        a.setName("A");
        Group b = new Group();
        b.setId("gb");
        b.setName("B");

        when(memberships.findByUserIdAndStatus("u1", MembershipStatus.ACTIVE)).thenReturn(List.of(
                new Membership("ga", "u1", GroupRole.OWNER, NOW),
                new Membership("gb", "u1", GroupRole.MEMBER, NOW)));
        when(groups.findAllById(any())).thenReturn(List.of(a, b));

        List<GroupResponse> result = service.listMine("u1");

        assertEquals(2, result.size());
        assertEquals(GroupRole.OWNER, result.stream().filter(g -> g.id().equals("ga")).findFirst().orElseThrow().myRole());
        assertEquals(GroupRole.MEMBER, result.stream().filter(g -> g.id().equals("gb")).findFirst().orElseThrow().myRole());
    }

    @Test
    void get_goesThroughTheGuard_andNonMembersAreRejected() {
        when(guard.forRead("g1", "stranger"))
                .thenThrow(new ApiException(ErrorCode.NOT_FOUND, "Group not found"));

        ApiException e = assertThrows(ApiException.class, () -> service.get("stranger", "g1"));
        assertEquals(ErrorCode.NOT_FOUND, e.getCode());
        verify(guard).forRead("g1", "stranger");
    }
}
