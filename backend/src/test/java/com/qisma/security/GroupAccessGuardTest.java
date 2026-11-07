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

    private void memberAs(String userId, GroupRole role) {
        when(memberships.findByGroupIdAndUserIdAndStatus("g1", userId, MembershipStatus.ACTIVE))
                .thenReturn(Optional.of(new Membership("g1", userId, role, Instant.now())));
    }

    private ErrorCode codeOf(Runnable action) {
        return assertThrows(ApiException.class, action::run).getCode();
    }

    @Test
    void nonMember_getsNotFound_notForbidden() {
        assertEquals(ErrorCode.NOT_FOUND, codeOf(() -> guard.forRead("g1", "stranger")));
        assertEquals(ErrorCode.NOT_FOUND, codeOf(() -> guard.forWrite("g1", "stranger")));
        assertEquals(ErrorCode.NOT_FOUND, codeOf(() -> guard.forOwner("g1", "stranger")));
    }

    @Test
    void unknownGroup_getsNotFound() {
        memberAs("u1", GroupRole.MEMBER);
        when(memberships.findByGroupIdAndUserIdAndStatus("ghost", "u1", MembershipStatus.ACTIVE))
                .thenReturn(Optional.of(new Membership("ghost", "u1", GroupRole.MEMBER, Instant.now())));
        when(groups.findById("ghost")).thenReturn(Optional.empty());

        assertEquals(ErrorCode.NOT_FOUND, codeOf(() -> guard.forRead("ghost", "u1")));
    }

    @Test
    void activeMember_canRead() {
        memberAs("u1", GroupRole.MEMBER);
        GroupAccessGuard.Access access = guard.forRead("g1", "u1");
        assertEquals("g1", access.group().getId());
        assertEquals(GroupRole.MEMBER, access.membership().getRole());
    }

    @Test
    void archivedGroup_canBeRead_butNotWritten() {
        memberAs("u1", GroupRole.OWNER);
        group.setStatus(GroupStatus.ARCHIVED);

        assertDoesNotThrow(() -> guard.forRead("g1", "u1"));
        assertEquals(ErrorCode.GROUP_ARCHIVED, codeOf(() -> guard.forWrite("g1", "u1")));
        assertEquals(ErrorCode.GROUP_ARCHIVED, codeOf(() -> guard.forOwner("g1", "u1")));
    }

    @Test
    void ordinaryMember_isForbiddenFromOwnerOperations() {
        memberAs("u1", GroupRole.MEMBER);
        assertEquals(ErrorCode.FORBIDDEN, codeOf(() -> guard.forOwner("g1", "u1")));
        assertDoesNotThrow(() -> guard.forWrite("g1", "u1"));
    }

    @Test
    void owner_passesAllChecks() {
        memberAs("owner", GroupRole.OWNER);
        assertDoesNotThrow(() -> guard.forRead("g1", "owner"));
        assertDoesNotThrow(() -> guard.forWrite("g1", "owner"));
        assertDoesNotThrow(() -> guard.forOwner("g1", "owner"));
    }

    @Test
    void inactiveMember_isTreatedAsNonMember() {
        // the repository is only asked for ACTIVE memberships, so an inactive one is simply not found
        when(memberships.findByGroupIdAndUserIdAndStatus("g1", "left", MembershipStatus.ACTIVE))
                .thenReturn(Optional.empty());
        assertEquals(ErrorCode.NOT_FOUND, codeOf(() -> guard.forRead("g1", "left")));
    }
}
