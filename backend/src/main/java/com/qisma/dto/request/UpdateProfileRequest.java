package com.qisma.dto.request;

import com.qisma.enums.Language;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @NotBlank @Size(max = 100) String fullName,
        @NotNull Language preferredLanguage
) {
}
