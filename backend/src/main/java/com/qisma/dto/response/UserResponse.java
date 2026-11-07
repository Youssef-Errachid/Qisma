package com.qisma.dto.response;

import com.qisma.enums.Language;

import java.time.Instant;

/** Public view of a user. Never contains the password hash. */
public record UserResponse(
        String id,
        String username,
        String fullName,
        String email,
        String profileImage,
        Language preferredLanguage,
        Instant createdAt
) {
}
