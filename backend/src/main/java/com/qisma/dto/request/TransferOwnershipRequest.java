package com.qisma.dto.request;

import jakarta.validation.constraints.NotBlank;

public record TransferOwnershipRequest(@NotBlank String newOwnerId) {
}
