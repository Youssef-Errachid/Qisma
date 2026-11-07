package com.qisma.repository;

import com.qisma.enums.SettlementStatus;
import com.qisma.model.Settlement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;

@Repository
public class MongoSettlementQueryStore implements SettlementQueryStore {

    private final MongoTemplate mongo;

    public MongoSettlementQueryStore(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    @Override
    public Page<Settlement> search(String groupId, SettlementStatus status, String userId, Pageable pageable) {
        List<Criteria> parts = new ArrayList<>();
        parts.add(Criteria.where("groupId").is(groupId));
        if (status != null) {
            parts.add(Criteria.where("status").is(status));
        }
        if (userId != null) {
            parts.add(new Criteria().orOperator(
                    Criteria.where("fromUserId").is(userId), Criteria.where("toUserId").is(userId)));
        }

        Query query = new Query(new Criteria().andOperator(parts.toArray(new Criteria[0])));
        long total = mongo.count(query, Settlement.class);
        List<Settlement> items = mongo.find(query.with(pageable), Settlement.class);
        return new PageImpl<>(items, pageable, total);
    }
}
