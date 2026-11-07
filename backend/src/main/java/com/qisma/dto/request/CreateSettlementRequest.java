package com.qisma.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/** The sender is never part of the request: it is always the authenticated user. */
public record CreateSettlementRequest(
        @NotBlank String toUserId,
        @NotNull @Positive @Max(1_000_000_000_000L) Long amountMinor,
        @Size(max = 200) String note
) {
}
