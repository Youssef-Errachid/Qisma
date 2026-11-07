package com.qisma.dto.response;

import com.qisma.enums.SettlementStatus;

import java.time.Instant;

public record SettlementResponse(
        String id,
        String groupId,
        String fromUserId,
        String fromUsername,
        String toUserId,
        String toUsername,
        long amountMinor,
        String currency,
        String note,
        SettlementStatus status,
        Instant createdAt,
        Instant confirmedAt,
        Instant rejectedAt,
        String rejectionReason,
        Instant cancelledAt,
        Long version
) {
}
