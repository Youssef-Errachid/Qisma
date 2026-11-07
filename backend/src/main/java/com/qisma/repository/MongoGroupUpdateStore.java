package com.qisma.repository;

import com.qisma.enums.GroupStatus;
import com.qisma.model.Group;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;

@Repository
public class MongoGroupUpdateStore implements GroupUpdateStore {

    private final MongoTemplate mongo;

    public MongoGroupUpdateStore(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    @Override
    public void updateDetails(String groupId, String name, String description, String currency) {
        Update update = new Update().set("name", name).set("description", description).set("updatedAt", Instant.now());
        if (currency != null) {
            update.set("currency", currency);
        }
        mongo.updateFirst(new Query(Criteria.where("_id").is(groupId)), update.inc("version", 1), Group.class);
    }

    @Override
    public void setOwner(String groupId, String ownerId) {
        mongo.updateFirst(new Query(Criteria.where("_id").is(groupId)),
                new Update().set("ownerId", ownerId).set("updatedAt", Instant.now()).inc("version", 1), Group.class);
    }

    @Override
    public boolean archive(String groupId, Instant now) {
        Query query = new Query(Criteria.where("_id").is(groupId).and("status").is(GroupStatus.ACTIVE));
        Update update = new Update().set("status", GroupStatus.ARCHIVED).set("archivedAt", now)
                .set("updatedAt", now).inc("version", 1);
        return mongo.updateFirst(query, update, Group.class).getModifiedCount() > 0;
    }
}
