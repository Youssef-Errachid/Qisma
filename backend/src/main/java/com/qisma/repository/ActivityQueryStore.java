package com.qisma.repository;

import com.qisma.enums.ActivityAction;
import com.qisma.enums.ActivityEntityType;
import com.qisma.model.ActivityLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Instant;

/** Read side of the history. The write side (ActivityLogStore) stays append-only. */
public interface ActivityQueryStore {

    /** Every filter is optional. fromInclusive and toExclusive bound createdAt. */
    Page<ActivityLog> search(String groupId, String actorId, ActivityAction action, ActivityEntityType entityType,
                             String entityId, Instant fromInclusive, Instant toExclusive, Pageable pageable);
}
