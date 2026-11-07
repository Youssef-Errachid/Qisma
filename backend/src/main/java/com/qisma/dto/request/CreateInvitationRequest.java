package com.qisma.dto.request;

import com.qisma.enums.InvitationType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record CreateInvitationRequest(
        @NotNull InvitationType type,
        @Min(1) @Max(30) Integer expiresInDays,
        @Min(1) @Max(50) Integer maxUses
) {
}
