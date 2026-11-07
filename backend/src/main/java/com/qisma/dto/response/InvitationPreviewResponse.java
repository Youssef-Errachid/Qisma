package com.qisma.dto.response;

import com.qisma.enums.InvitationType;

import java.time.Instant;

public record InvitationPreviewResponse(String groupName, String currency, InvitationType type, Instant expiresAt) {
}
