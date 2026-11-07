package com.qisma.repository;

import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.model.Group;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

@Repository
public class MongoGroupLedgerStore implements GroupLedgerStore {

    private final MongoTemplate mongo;

    public MongoGroupLedgerStore(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    @Override
    public long advance(String groupId) {
        Group group = mongo.findAndModify(
                new Query(Criteria.where("_id").is(groupId)),
                new Update().inc("ledgerVersion", 1),
                FindAndModifyOptions.options().returnNew(true),
                Group.class);
        if (group == null) {
            throw new ApiException(ErrorCode.NOT_FOUND, "Group not found");
        }
        return group.getLedgerVersion();
    }
}
