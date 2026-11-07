package com.qisma.dto.response;

import com.qisma.enums.ActivityAction;
import com.qisma.enums.ActivityEntityType;

import java.time.Instant;
import java.util.Map;

/** One line of the group history: who did what, when, and the value before and after. */
public record ActivityResponse(
        String id,
        ActivityAction action,
        ActivityEntityType entityType,
        String entityId,
        String actorId,
        String actorUsername,
        Instant createdAt,
        Map<String, Object> oldValue,
        Map<String, Object> newValue
) {
}
