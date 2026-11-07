package com.qisma.model;

import com.qisma.enums.ActivityAction;
import com.qisma.enums.ActivityEntityType;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.Map;

/** One immutable line of the group history. Written together with the change it describes. */
@Document(collection = "activityLogs")
public class ActivityLog {

    @Id
    private String id;

    private String groupId;
    private String actorId;
    private ActivityAction action;
    private ActivityEntityType entityType;
    private String entityId;
    private Map<String, Object> oldValue;
    private Map<String, Object> newValue;
    private Instant createdAt;

    public ActivityLog() {
    }

    public ActivityLog(String groupId, String actorId, ActivityAction action, String entityId,
                       Map<String, Object> oldValue, Map<String, Object> newValue, Instant createdAt) {
        this.groupId = groupId;
        this.actorId = actorId;
        this.action = action;
        this.entityType = action.entityType();
        this.entityId = entityId;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.createdAt = createdAt;
    }

    public String getId() { return id; }
    public String getGroupId() { return groupId; }
    public String getActorId() { return actorId; }
    public ActivityAction getAction() { return action; }
    public ActivityEntityType getEntityType() { return entityType; }
    public String getEntityId() { return entityId; }
    public Map<String, Object> getOldValue() { return oldValue; }
    public Map<String, Object> getNewValue() { return newValue; }
    public Instant getCreatedAt() { return createdAt; }
}
