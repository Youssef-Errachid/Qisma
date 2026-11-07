package com.qisma.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(

        @NotBlank
        @Size(max = 72)
        String currentPassword,

        @NotBlank
        @Size(min = 8, max = 72)
        @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$", message = "must contain at least one letter and one digit")
        String newPassword,

        @NotBlank
        String confirmNewPassword
) {
}
