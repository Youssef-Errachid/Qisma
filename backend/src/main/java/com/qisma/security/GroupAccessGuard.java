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
import org.springframework.stereotype.Component;

/**
 * The single place that decides who may touch a group. Every group operation goes through it.
 * Non-members always get 404, so the existence of a group is never revealed.
 */
@Component
public class GroupAccessGuard {

    public record Access(Group group, Membership membership) {
    }

    private final GroupRepository groups;
    private final MembershipRepository memberships;

    public GroupAccessGuard(GroupRepository groups, MembershipRepository memberships) {
        this.groups = groups;
        this.memberships = memberships;
    }

    /** Reading: any active member, even of an archived group. */
    public Access forRead(String groupId, String userId) {
        Membership membership = memberships
                .findByGroupIdAndUserIdAndStatus(groupId, userId, MembershipStatus.ACTIVE)
                .orElseThrow(GroupAccessGuard::notFound);
        Group group = groups.findById(groupId).orElseThrow(GroupAccessGuard::notFound);
        return new Access(group, membership);
    }

    /** Writing: an active member of an ACTIVE group. */
    public Access forWrite(String groupId, String userId) {
        Access access = forRead(groupId, userId);
        if (access.group().getStatus() != GroupStatus.ACTIVE) {
            throw new ApiException(ErrorCode.GROUP_ARCHIVED, "This group is archived");
        }
        return access;
    }

    /** Owner-only operations. */
    public Access forOwner(String groupId, String userId) {
        Access access = forWrite(groupId, userId);
        if (access.membership().getRole() != GroupRole.OWNER) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Only the group owner can do this");
        }
        return access;
    }

    private static ApiException notFound() {
        return new ApiException(ErrorCode.NOT_FOUND, "Group not found");
    }
}
