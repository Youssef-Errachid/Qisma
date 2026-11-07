package com.qisma.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** The currency can only change before the group's first financial operation. */
public record UpdateGroupRequest(
        @NotBlank @Size(max = 80) String name,
        @Size(max = 500) String description,
        @Pattern(regexp = "^[A-Za-z]{3}$", message = "must be a 3-letter ISO 4217 currency code") String currency
) {
}
