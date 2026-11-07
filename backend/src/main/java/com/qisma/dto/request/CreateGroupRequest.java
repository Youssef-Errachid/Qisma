package com.qisma.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateGroupRequest(

        @NotBlank
        @Size(max = 80)
        String name,

        @Size(max = 500)
        String description,

        /** ISO 4217 code. Optional: defaults to MAD. */
        @Pattern(regexp = "^[A-Za-z]{3}$", message = "must be a 3-letter ISO 4217 currency code")
        String currency
) {
}
