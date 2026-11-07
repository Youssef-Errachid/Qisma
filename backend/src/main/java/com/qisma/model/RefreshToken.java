package com.qisma.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/** Only the SHA-256 hash of the token is stored, never the token itself. */
@Document(collection = "refreshTokens")
public class RefreshToken {

    @Id
    private String id;
    private String userId;
    private String tokenHash;
    private String familyId;
    private Instant createdAt;
    private Instant expiresAt;
    private Instant revokedAt;

    public RefreshToken() {
    }

    public RefreshToken(String userId, String tokenHash, String familyId, Instant createdAt, Instant expiresAt) {
        this.userId = userId;
        this.tokenHash = tokenHash;
        this.familyId = familyId;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    public String getId() { return id; }
    public String getUserId() { return userId; }
    public String getTokenHash() { return tokenHash; }
    public String getFamilyId() { return familyId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public void setRevokedAt(Instant revokedAt) { this.revokedAt = revokedAt; }
}
