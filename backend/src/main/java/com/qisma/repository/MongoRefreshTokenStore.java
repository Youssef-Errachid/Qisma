package com.qisma.repository;

import com.qisma.model.RefreshToken;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

@Repository
public class MongoRefreshTokenStore implements RefreshTokenStore {

    private final MongoTemplate mongo;

    public MongoRefreshTokenStore(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    @Override
    public RefreshToken save(RefreshToken token) {
        return mongo.save(token);
    }

    @Override
    public Optional<RefreshToken> claimActive(String tokenHash, Instant now) {
        Query query = new Query(Criteria.where("tokenHash").is(tokenHash)
                .and("revokedAt").is(null)
                .and("expiresAt").gt(now));
        Update update = new Update().set("revokedAt", now);
        return Optional.ofNullable(mongo.findAndModify(
                query, update, FindAndModifyOptions.options().returnNew(false), RefreshToken.class));
    }

    @Override
    public Optional<RefreshToken> findByHash(String tokenHash) {
        return Optional.ofNullable(mongo.findOne(
                new Query(Criteria.where("tokenHash").is(tokenHash)), RefreshToken.class));
    }

    @Override
    public void revokeFamily(String familyId, Instant now) {
        Query query = new Query(Criteria.where("familyId").is(familyId).and("revokedAt").is(null));
        mongo.updateMulti(query, new Update().set("revokedAt", now), RefreshToken.class);
    }
}
