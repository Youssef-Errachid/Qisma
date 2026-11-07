package com.qisma.model;

import com.qisma.enums.GroupStatus;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "groups")
public class Group {

    @Id
    private String id;

    private String name;
    private String description;
    private String ownerId;
    private String currency;
    private GroupStatus status = GroupStatus.ACTIVE;

    /** Incremented by every financial operation of the group (concurrency guard, used later). */
    private long ledgerVersion;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;

    private Instant archivedAt;

    @Version
    private Long version;

    public Group() {
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getOwnerId() { return ownerId; }
    public void setOwnerId(String ownerId) { this.ownerId = ownerId; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public GroupStatus getStatus() { return status; }
    public void setStatus(GroupStatus status) { this.status = status; }

    public long getLedgerVersion() { return ledgerVersion; }
    public void setLedgerVersion(long ledgerVersion) { this.ledgerVersion = ledgerVersion; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }

    public Long getVersion() { return version; }
}
