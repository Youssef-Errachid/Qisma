package com.qisma.service;

import com.qisma.enums.ActivityAction;

import java.util.Map;

public interface ActivityLogService {

    /** Must be called inside the transaction of the change it records, so both are saved or neither. */
    void record(String groupId, String actorId, ActivityAction action, String entityId,
                Map<String, Object> oldValue, Map<String, Object> newValue);
}
