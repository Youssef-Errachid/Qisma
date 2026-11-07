package com.qisma.repository;

import com.qisma.enums.InvitationStatus;
import com.qisma.model.Invitation;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public class MongoInvitationStore implements InvitationStore {

    private final MongoTemplate mongo;

    public MongoInvitationStore(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    @Override
    public Invitation save(Invitation invitation) {
        return mongo.save(invitation);
    }

    @Override
    public Optional<Invitation> findById(String id) {
        return Optional.ofNullable(mongo.findById(id, Invitation.class));
    }

    @Override
    public Optional<Invitation> findBySecretHash(String secretHash) {
        return Optional.ofNullable(mongo.findOne(
                new Query(Criteria.where("secretHash").is(secretHash)), Invitation.class));
    }

    @Override
    public List<Invitation> findByGroupId(String groupId) {
        return mongo.find(new Query(Criteria.where("groupId").is(groupId))
                .with(Sort.by(Sort.Direction.DESC, "createdAt")).limit(200), Invitation.class);
    }

    @Override
    public Optional<Invitation> claimUse(String secretHash, String userId, Instant now) {
        // useCount < maxUses is expressed with $expr so the check and the increment are one atomic step
        Query query = new Query(Criteria.where("secretHash").is(secretHash)
                .and("status").is(InvitationStatus.PENDING)
                .and("expiresAt").gt(now)
                .and("acceptedBy").ne(userId)
                .andOperator(Criteria.expr(
                        org.springframework.data.mongodb.core.aggregation.ComparisonOperators
                                .valueOf("useCount")
                                .lessThan("$maxUses"))));
        Update update = new Update().inc("useCount", 1).push("acceptedBy", userId);

        Invitation claimed = mongo.findAndModify(
                query, update, FindAndModifyOptions.options().returnNew(true), Invitation.class);
        if (claimed == null) {
            return Optional.empty();
        }
        if (claimed.getUseCount() >= claimed.getMaxUses()) {
            mongo.updateFirst(
                    new Query(Criteria.where("_id").is(claimed.getId()).and("status").is(InvitationStatus.PENDING)),
                    new Update().set("status", InvitationStatus.ACCEPTED), Invitation.class);
        }
        return Optional.of(claimed);
    }

    @Override
    public void releaseUse(String invitationId, String userId) {
        Query query = new Query(Criteria.where("_id").is(invitationId).and("acceptedBy").is(userId));
        Update update = new Update().inc("useCount", -1).pull("acceptedBy", userId)
                .set("status", InvitationStatus.PENDING);
        mongo.updateFirst(query, update, Invitation.class);
    }

    @Override
    public boolean revokePending(String invitationId, String groupId, Instant now) {
        Query query = new Query(Criteria.where("_id").is(invitationId)
                .and("groupId").is(groupId)
                .and("status").is(InvitationStatus.PENDING));
        Update update = new Update().set("status", InvitationStatus.REVOKED).set("revokedAt", now);
        return mongo.updateFirst(query, update, Invitation.class).getModifiedCount() > 0;
    }
}
