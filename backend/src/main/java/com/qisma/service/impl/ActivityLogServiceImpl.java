package com.qisma.service.impl;

import com.qisma.enums.ActivityAction;
import com.qisma.model.ActivityLog;
import com.qisma.repository.ActivityLogStore;
import com.qisma.service.ActivityLogService;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.Map;

@Service
public class ActivityLogServiceImpl implements ActivityLogService {

    private final ActivityLogStore store;
    private final Clock clock;

    public ActivityLogServiceImpl(ActivityLogStore store, Clock clock) {
        this.store = store;
        this.clock = clock;
    }

    @Override
    public void record(String groupId, String actorId, ActivityAction action, String entityId,
                       Map<String, Object> oldValue, Map<String, Object> newValue) {
        store.append(new ActivityLog(groupId, actorId, action, entityId, oldValue, newValue, clock.instant()));
    }
}
