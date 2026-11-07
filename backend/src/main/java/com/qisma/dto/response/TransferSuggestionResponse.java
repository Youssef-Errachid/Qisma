package com.qisma.dto.response;

public record TransferSuggestionResponse(
        String fromUserId,
        String fromUsername,
        String toUserId,
        String toUsername,
        long amountMinor
) {
}
