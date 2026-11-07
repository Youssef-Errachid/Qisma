package com.qisma.service.impl;

import com.qisma.dto.request.CreateInvitationRequest;
import com.qisma.dto.response.GroupResponse;
import com.qisma.dto.response.InvitationCreatedResponse;
import com.qisma.dto.response.InvitationPreviewResponse;
import com.qisma.dto.response.InvitationResponse;
import com.qisma.enums.GroupRole;
import com.qisma.enums.GroupStatus;
import com.qisma.enums.InvitationStatus;
import com.qisma.enums.InvitationType;
import com.qisma.enums.MembershipStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.mapper.GroupMapper;
import com.qisma.model.Group;
import com.qisma.model.Invitation;
import com.qisma.model.Membership;
import com.qisma.repository.GroupRepository;
import com.qisma.repository.InvitationStore;
import com.qisma.repository.MembershipRepository;
import com.qisma.security.AttemptLimiter;
import com.qisma.security.GroupAccessGuard;
import com.qisma.service.InvitationService;
import com.qisma.util.InvitationSecrets;
import com.qisma.util.TokenUtil;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
public class InvitationServiceImpl implements InvitationService {

    static final int MAX_MEMBERS_PER_GROUP = 50;
    static final int MAX_GROUPS_PER_USER = 50;
    static final int DEFAULT_EXPIRY_DAYS = 7;
    static final int DEFAULT_CODE_USES = 1;
    static final int DEFAULT_LINK_USES = 10;

    private final InvitationStore invitations;
    private final GroupRepository groups;
    private final MembershipRepository memberships;
    private final GroupAccessGuard guard;
    private final GroupMapper groupMapper;
    private final AttemptLimiter limiter;
    private final Clock clock;

    public InvitationServiceImpl(InvitationStore invitations, GroupRepository groups,
                                 MembershipRepository memberships, GroupAccessGuard guard,
                                 GroupMapper groupMapper, AttemptLimiter limiter, Clock clock) {
        this.invitations = invitations;
        this.groups = groups;
        this.memberships = memberships;
        this.guard = guard;
        this.groupMapper = groupMapper;
        this.limiter = limiter;
        this.clock = clock;
    }

    @Override
    public InvitationCreatedResponse create(String userId, String groupId, CreateInvitationRequest request) {
        guard.forOwner(groupId, userId);

        InvitationType type = request.type();
        int maxUses = request.maxUses() != null ? request.maxUses()
                : (type == InvitationType.CODE ? DEFAULT_CODE_USES : DEFAULT_LINK_USES);
        int days = request.expiresInDays() != null ? request.expiresInDays() : DEFAULT_EXPIRY_DAYS;
        Instant now = clock.instant();

        for (int attempt = 0; attempt < 3; attempt++) {
            String secret = type == InvitationType.CODE ? InvitationSecrets.newCode() : TokenUtil.randomToken();
            Invitation invitation = new Invitation(groupId, userId, type, InvitationSecrets.hash(secret),
                    maxUses, now, now.plus(Duration.ofDays(days)));
            try {
                Invitation saved = invitations.save(invitation);
                return new InvitationCreatedResponse(saved.getId(), type, secret, maxUses, saved.getExpiresAt());
            } catch (DuplicateKeyException e) {
                // astronomically unlikely secret collision: generate another one
            }
        }
        throw new ApiException(ErrorCode.INTERNAL_ERROR, "Could not generate a unique invitation");
    }

    @Override
    public List<InvitationResponse> list(String userId, String groupId) {
        guard.forOwner(groupId, userId);
        Instant now = clock.instant();
        return invitations.findByGroupId(groupId).stream().map(i -> toResponse(i, now)).toList();
    }

    @Override
    public void revoke(String userId, String groupId, String invitationId) {
        guard.forOwner(groupId, userId);
        if (invitations.revokePending(invitationId, groupId, clock.instant())) {
            return;
        }
        boolean belongsToGroup = invitations.findById(invitationId)
                .filter(i -> i.getGroupId().equals(groupId)).isPresent();
        if (!belongsToGroup) {
            throw new ApiException(ErrorCode.NOT_FOUND, "Invitation not found");
        }
        throw new ApiException(ErrorCode.INVITATION_NOT_PENDING, "Only a pending invitation can be revoked");
    }

    @Override
    public InvitationPreviewResponse preview(String userId, String secret) {
        Invitation invitation = findUsable(userId, secret);
        Group group = groups.findById(invitation.getGroupId())
                .filter(g -> g.getStatus() == GroupStatus.ACTIVE)
                .orElseThrow(() -> failure(userId));
        return new InvitationPreviewResponse(group.getName(), group.getCurrency(),
                invitation.getType(), invitation.getExpiresAt());
    }

    @Override
    public GroupResponse accept(String userId, String secret) {
        Invitation invitation = findUsable(userId, secret);
        Group group = groups.findById(invitation.getGroupId())
                .filter(g -> g.getStatus() == GroupStatus.ACTIVE)
                .orElseThrow(() -> failure(userId));

        // cheap checks first, so a refused request never consumes a use
        Membership existing = memberships.findByGroupIdAndUserId(group.getId(), userId).orElse(null);
        if (existing != null && existing.getStatus() == MembershipStatus.ACTIVE) {
            throw new ApiException(ErrorCode.ALREADY_MEMBER, "You are already a member of this group");
        }
        requireRoom(group.getId(), userId);

        String hash = InvitationSecrets.hash(secret);
        Invitation claimed = invitations.claimUse(hash, userId, clock.instant()).orElseThrow(() -> failure(userId));

        try {
            if (existing != null) {
                // coming back keeps the same membership, so the financial history stays attached
                existing.setStatus(MembershipStatus.ACTIVE);
                existing.setRole(GroupRole.MEMBER);
                existing.setLeftAt(null);
                memberships.save(existing);
            } else {
                memberships.save(new Membership(group.getId(), userId, GroupRole.MEMBER, clock.instant()));
            }
        } catch (DuplicateKeyException e) {
            invitations.releaseUse(claimed.getId(), userId);
            throw new ApiException(ErrorCode.ALREADY_MEMBER, "You are already a member of this group");
        } catch (RuntimeException e) {
            invitations.releaseUse(claimed.getId(), userId);
            throw e;
        }
        return groupMapper.toResponse(group, GroupRole.MEMBER);
    }

    private void requireRoom(String groupId, String userId) {
        if (memberships.countByGroupIdAndStatus(groupId, MembershipStatus.ACTIVE) >= MAX_MEMBERS_PER_GROUP) {
            throw new ApiException(ErrorCode.LIMIT_REACHED,
                    "This group cannot have more than " + MAX_MEMBERS_PER_GROUP + " members");
        }
        if (memberships.countByUserIdAndStatus(userId, MembershipStatus.ACTIVE) >= MAX_GROUPS_PER_USER) {
            throw new ApiException(ErrorCode.LIMIT_REACHED,
                    "You cannot belong to more than " + MAX_GROUPS_PER_USER + " groups");
        }
    }

    /** Unknown, expired, revoked and used-up invitations all look the same from the outside. */
    private Invitation findUsable(String userId, String secret) {
        limiter.checkAllowed(userId);
        Instant now = clock.instant();
        return invitations.findBySecretHash(InvitationSecrets.hash(secret))
                .filter(i -> i.getStatus() == InvitationStatus.PENDING
                        && i.getExpiresAt().isAfter(now)
                        && i.getUseCount() < i.getMaxUses())
                .orElseThrow(() -> failure(userId));
    }

    private ApiException failure(String userId) {
        limiter.recordFailure(userId);
        return new ApiException(ErrorCode.INVITATION_INVALID, "Invitation is invalid or has expired");
    }

    private static InvitationResponse toResponse(Invitation i, Instant now) {
        InvitationStatus status = i.getStatus();
        if (status == InvitationStatus.PENDING && !i.getExpiresAt().isAfter(now)) {
            status = InvitationStatus.EXPIRED;
        }
        return new InvitationResponse(i.getId(), i.getType(), status, i.getUseCount(), i.getMaxUses(),
                i.getExpiresAt(), i.getCreatedAt());
    }
}
