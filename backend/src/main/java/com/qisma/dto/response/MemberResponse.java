package com.qisma.dto.response;

import com.qisma.enums.GroupRole;
import com.qisma.enums.MembershipStatus;

import java.time.Instant;

/** Public view of a group member. The email address is deliberately not included. */
public record MemberResponse(
        String userId,
        String username,
        String fullName,
        GroupRole role,
        MembershipStatus status,
        Instant joinedAt
) {
}
