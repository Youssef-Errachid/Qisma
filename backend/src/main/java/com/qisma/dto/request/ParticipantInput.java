package com.qisma.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

/** EQUAL uses only userId, CUSTOM needs shareMinor, PERCENTAGE needs percentageBp (10000 = 100%). */
public record ParticipantInput(
        @NotBlank String userId,
        @PositiveOrZero Long shareMinor,
        @Min(0) @Max(10000) Integer percentageBp
) {
}
