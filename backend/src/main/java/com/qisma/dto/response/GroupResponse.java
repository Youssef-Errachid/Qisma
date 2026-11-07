package com.qisma.dto.response;

import com.qisma.enums.GroupRole;
import com.qisma.enums.GroupStatus;

import java.time.Instant;

public record GroupResponse(
        String id,
        String name,
        String description,
        String currency,
        GroupStatus status,
        String ownerId,
        GroupRole myRole,
        Instant createdAt
) {
}
