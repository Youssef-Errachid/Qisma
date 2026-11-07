package com.qisma.repository;

import com.qisma.enums.ActivityAction;
import com.qisma.enums.ActivityEntityType;
import com.qisma.model.ActivityLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Repository
public class MongoActivityQueryStore implements ActivityQueryStore {

    private final MongoTemplate mongo;

    public MongoActivityQueryStore(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    @Override
    public Page<ActivityLog> search(String groupId, String actorId, ActivityAction action,
                                    ActivityEntityType entityType, String entityId,
                                    Instant fromInclusive, Instant toExclusive, Pageable pageable) {
        List<Criteria> parts = new ArrayList<>();
        parts.add(Criteria.where("groupId").is(groupId));
        if (actorId != null) {
            parts.add(Criteria.where("actorId").is(actorId));
        }
        if (action != null) {
            parts.add(Criteria.where("action").is(action));
        }
        if (entityType != null) {
            parts.add(Criteria.where("entityType").is(entityType));
        }
        if (entityId != null) {
            parts.add(Criteria.where("entityId").is(entityId));
        }
        if (fromInclusive != null || toExclusive != null) {
            Criteria period = Criteria.where("createdAt");
            if (fromInclusive != null) {
                period = period.gte(fromInclusive);
            }
            if (toExclusive != null) {
                period = period.lt(toExclusive);
            }
            parts.add(period);
        }

        Query query = new Query(new Criteria().andOperator(parts.toArray(new Criteria[0])));
        long total = mongo.count(query, ActivityLog.class);
        List<ActivityLog> items = mongo.find(query.with(pageable), ActivityLog.class);
        return new PageImpl<>(items, pageable, total);
    }
}
