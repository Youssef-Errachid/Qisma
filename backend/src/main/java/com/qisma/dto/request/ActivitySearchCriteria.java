package com.qisma.dto.request;

import com.qisma.enums.ActivityAction;
import com.qisma.enums.ActivityEntityType;

import java.time.LocalDate;

/** Every field is optional. from and to are whole days (UTC), both inclusive. */
public record ActivitySearchCriteria(String actorId, ActivityAction action, ActivityEntityType entityType,
                                     String entityId, LocalDate from, LocalDate to) {
}
