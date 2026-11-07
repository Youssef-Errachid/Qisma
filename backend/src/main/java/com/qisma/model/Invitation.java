package com.qisma.model;

import com.qisma.enums.InvitationStatus;
import com.qisma.enums.InvitationType;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** Only the SHA-256 hash of the secret is stored; the secret itself is shown once at creation. */
@Document(collection = "invitations")
public class Invitation {

    @Id
    private String id;

    private String groupId;
    private String invitedBy;
    private InvitationType type;
    private String secretHash;
    private int maxUses;
    private int useCount;
    private List<String> acceptedBy = new ArrayList<>();
    private InvitationStatus status = InvitationStatus.PENDING;
    private Instant expiresAt;
    private Instant createdAt;
    private Instant revokedAt;

    public Invitation() {
    }

    public Invitation(String groupId, String invitedBy, InvitationType type, String secretHash,
                      int maxUses, Instant createdAt, Instant expiresAt) {
        this.groupId = groupId;
        this.invitedBy = invitedBy;
        this.type = type;
        this.secretHash = secretHash;
        this.maxUses = maxUses;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    public String getId() { return id; }
    public String getGroupId() { return groupId; }
    public String getInvitedBy() { return invitedBy; }
    public InvitationType getType() { return type; }
    public String getSecretHash() { return secretHash; }
    public int getMaxUses() { return maxUses; }
    public int getUseCount() { return useCount; }
    public List<String> getAcceptedBy() { return acceptedBy; }
    public InvitationStatus getStatus() { return status; }
    public void setStatus(InvitationStatus status) { this.status = status; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public void setRevokedAt(Instant revokedAt) { this.revokedAt = revokedAt; }
}
