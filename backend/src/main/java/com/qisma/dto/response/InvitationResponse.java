package com.qisma.dto.response;

import com.qisma.enums.InvitationStatus;
import com.qisma.enums.InvitationType;

import java.time.Instant;

public record InvitationResponse(
        String id,
        InvitationType type,
        InvitationStatus status,
        int useCount,
        int maxUses,
        Instant expiresAt,
        Instant createdAt
) {
}
