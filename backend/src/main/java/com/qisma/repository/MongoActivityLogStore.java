package com.qisma.repository;

import com.qisma.model.ActivityLog;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class MongoActivityLogStore implements ActivityLogStore {

    private final MongoTemplate mongo;

    public MongoActivityLogStore(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    @Override
    public ActivityLog append(ActivityLog log) {
        return mongo.insert(log);
    }
}
