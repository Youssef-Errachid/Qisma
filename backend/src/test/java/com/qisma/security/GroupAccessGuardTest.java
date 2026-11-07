package com.qisma.security;

import com.qisma.enums.GroupRole;
import com.qisma.enums.GroupStatus;
import com.qisma.enums.MembershipStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.model.Group;
import com.qisma.model.Membership;
import com.qisma.repository.GroupRepository;
import com.qisma.repository.MembershipRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;
import java.util.function.BiFunction;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GroupAccessGuardTest {

    private GroupRepository groups;
    private MembershipRepository memberships;
    private GroupAccessGuard guard;
    private Group group;

    @BeforeEach
    void setUp() {
        groups = mock(GroupRepository.class);
        memberships = mock(MembershipRepository.class);
        guard = new GroupAccessGuard(groups, memberships);

        group = new Group();
        group.setId("g1");
        group.setName("House");
        when(groups.findById("g1")).thenReturn(Optional.of(group));
    }

    private void memberAs(String userId, GroupRole role, MembershipStatus status) {
        Membership m = new Membership("g1", userId, role, Instant.now());
        m.setStatus(status);
        when(memberships.findByGroupIdAndUserId("g1", userId)).thenReturn(Optional.of(m));
    }

    private ErrorCode codeOf(BiFunction<String, String, GroupAccessGuard.Access> level, String groupId, String userId) {
        return assertThrows(ApiException.class, () -> level.apply(groupId, userId)).getCode();
    }

    // ---------------- strangers ----------------

    @Test
    void aNonMember_getsNotFound_atEveryLevel_neverForbidden() {
        assertEquals(ErrorCode.NOT_FOUND, codeOf(guard::forRead, "g1", "stranger"));
        assertEquals(ErrorCode.NOT_FOUND, codeOf(guard::forSettle, "g1", "stranger"));
        assertEquals(ErrorCode.NOT_FOUND, codeOf(guard::forWrite, "g1", "stranger"));
        assertEquals(ErrorCode.NOT_FOUND, codeOf(guard::forOwner, "g1", "stranger"));
    }

    @Test
    void anUnknownGroup_getsNotFound() {
        when(memberships.findByGroupIdAndUserId("ghost", "u1"))
                .thenReturn(Optional.of(new Membership("ghost", "u1", GroupRole.MEMBER, Instant.now())));
        when(groups.findById("ghost")).thenReturn(Optional.empty());

        assertEquals(ErrorCode.NOT_FOUND, codeOf(guard::forRead, "ghost", "u1"));
    }

    // ---------------- active members ----------------

    @Test
    void anActiveMember_canReadSettleAndWrite_butIsNotTheOwner() {
        memberAs("u1", GroupRole.MEMBER, MembershipStatus.ACTIVE);

        assertDoesNotThrow(() -> guard.forRead("g1", "u1"));
        assertDoesNotThrow(() -> guard.forSettle("g1", "u1"));
        assertDoesNotThrow(() -> guard.forWrite("g1", "u1"));
        assertEquals(ErrorCode.FORBIDDEN, codeOf(guard::forOwner, "g1", "u1"));
    }

    @Test
    void theOwner_passesEveryLevel() {
        memberAs("boss", GroupRole.OWNER, MembershipStatus.ACTIVE);

        assertDoesNotThrow(() -> guard.forRead("g1", "boss"));
        assertDoesNotThrow(() -> guard.forSettle("g1", "boss"));
        assertDoesNotThrow(() -> guard.forWrite("g1", "boss"));
        assertDoesNotThrow(() -> guard.forOwner("g1", "boss"));
    }

    // ---------------- members who left: settle-only ----------------

    @Test
    void aMemberWhoLeft_stillSeesTheirData_andCanStillSettle() {
        memberAs("left", GroupRole.MEMBER, MembershipStatus.INACTIVE);

        GroupAccessGuard.Access read = guard.forRead("g1", "left");
        assertEquals(MembershipStatus.INACTIVE, read.membership().getStatus());
        assertDoesNotThrow(() -> guard.forSettle("g1", "left"));
    }

    @Test
    void aMemberWhoLeft_cannotAddExpensesOrInvite_andIsNotTheOwner() {
        memberAs("left", GroupRole.MEMBER, MembershipStatus.INACTIVE);

        assertEquals(ErrorCode.FORBIDDEN, codeOf(guard::forWrite, "g1", "left"));
        assertEquals(ErrorCode.FORBIDDEN, codeOf(guard::forOwner, "g1", "left"));
    }

    // ---------------- archived groups: read-only ----------------

    @Test
    void anArchivedGroup_canBeRead_butNothingElse() {
        memberAs("boss", GroupRole.OWNER, MembershipStatus.ACTIVE);
        group.setStatus(GroupStatus.ARCHIVED);

        assertDoesNotThrow(() -> guard.forRead("g1", "boss"));
        assertEquals(ErrorCode.GROUP_ARCHIVED, codeOf(guard::forSettle, "g1", "boss"));
        assertEquals(ErrorCode.GROUP_ARCHIVED, codeOf(guard::forWrite, "g1", "boss"));
        assertEquals(ErrorCode.GROUP_ARCHIVED, codeOf(guard::forOwner, "g1", "boss"));
    }

    @Test
    void aMemberWhoLeft_ofAnArchivedGroup_canOnlyRead() {
        memberAs("left", GroupRole.MEMBER, MembershipStatus.INACTIVE);
        group.setStatus(GroupStatus.ARCHIVED);

        assertDoesNotThrow(() -> guard.forRead("g1", "left"));
        assertEquals(ErrorCode.GROUP_ARCHIVED, codeOf(guard::forSettle, "g1", "left"));
        assertEquals(ErrorCode.GROUP_ARCHIVED, codeOf(guard::forWrite, "g1", "left"));
    }

    @Test
    void theAccessReturned_carriesTheGroupAndTheMembership() {
        memberAs("u1", GroupRole.MEMBER, MembershipStatus.ACTIVE);

        GroupAccessGuard.Access access = guard.forWrite("g1", "u1");

        assertEquals("g1", access.group().getId());
        assertEquals(GroupRole.MEMBER, access.membership().getRole());
    }
}
