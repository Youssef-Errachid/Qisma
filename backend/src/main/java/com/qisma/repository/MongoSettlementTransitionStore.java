package com.qisma.repository;

import com.qisma.enums.SettlementStatus;
import com.qisma.model.Settlement;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

@Repository
public class MongoSettlementTransitionStore implements SettlementTransitionStore {

    private final MongoTemplate mongo;

    public MongoSettlementTransitionStore(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    @Override
    public Optional<Settlement> markConfirmed(String settlementId, String groupId, String receiverId, Instant now) {
        return transition(pending(settlementId, groupId).and("toUserId").is(receiverId),
                new Update().set("status", SettlementStatus.CONFIRMED).set("confirmedAt", now));
    }

    @Override
    public Optional<Settlement> markRejected(String settlementId, String groupId, String receiverId,
                                             String reason, Instant now) {
        return transition(pending(settlementId, groupId).and("toUserId").is(receiverId),
                new Update().set("status", SettlementStatus.REJECTED).set("rejectedAt", now)
                        .set("rejectionReason", reason));
    }

    @Override
    public Optional<Settlement> markCancelled(String settlementId, String groupId, String senderId, Instant now) {
        return transition(pending(settlementId, groupId).and("fromUserId").is(senderId),
                new Update().set("status", SettlementStatus.CANCELLED).set("cancelledAt", now));
    }

    private static Criteria pending(String settlementId, String groupId) {
        return Criteria.where("_id").is(settlementId)
                .and("groupId").is(groupId)
                .and("status").is(SettlementStatus.PENDING);
    }

    private Optional<Settlement> transition(Criteria criteria, Update update) {
        // the raw update bypasses Spring's @Version handling, so the version is advanced here
        update.inc("version", 1);
        return Optional.ofNullable(mongo.findAndModify(new Query(criteria), update,
                FindAndModifyOptions.options().returnNew(true), Settlement.class));
    }
}
