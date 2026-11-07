package com.qisma.dto.response;

import com.qisma.enums.InvitationType;

import java.time.Instant;

/** The only response that ever contains the secret. It cannot be retrieved again. */
public record InvitationCreatedResponse(
        String id,
        InvitationType type,
        String secret,
        int maxUses,
        Instant expiresAt
) {
}
