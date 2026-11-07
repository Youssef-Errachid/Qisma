package com.qisma.model;

import com.qisma.enums.GroupRole;
import com.qisma.enums.MembershipStatus;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/** Link between a user and a group. Never deleted: it keeps the financial history of the member. */
@Document(collection = "memberships")
public class Membership {

    @Id
    private String id;

    private String groupId;
    private String userId;
    private GroupRole role;
    private MembershipStatus status = MembershipStatus.ACTIVE;
    private Instant joinedAt;
    private Instant leftAt;

    public Membership() {
    }

    public Membership(String groupId, String userId, GroupRole role, Instant joinedAt) {
        this.groupId = groupId;
        this.userId = userId;
        this.role = role;
        this.joinedAt = joinedAt;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getGroupId() { return groupId; }
    public String getUserId() { return userId; }

    public GroupRole getRole() { return role; }
    public void setRole(GroupRole role) { this.role = role; }

    public MembershipStatus getStatus() { return status; }
    public void setStatus(MembershipStatus status) { this.status = status; }

    public Instant getJoinedAt() { return joinedAt; }

    public Instant getLeftAt() { return leftAt; }
    public void setLeftAt(Instant leftAt) { this.leftAt = leftAt; }
}
