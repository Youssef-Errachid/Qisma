package com.qisma.config;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.data.mongodb.core.query.Criteria;

/** Indexes of the settlements collection. Idempotent. */
@Configuration
public class SettlementIndexConfig {

    @Bean
    ApplicationRunner createSettlementIndexes(MongoTemplate mongo) {
        return args -> {
            var settlements = mongo.indexOps("settlements");
            settlements.createIndex(new Index().on("groupId", Sort.Direction.ASC)
                    .on("status", Sort.Direction.ASC)
                    .on("createdAt", Sort.Direction.DESC).named("ix_settlements_group_status_createdAt"));
            settlements.createIndex(new Index().on("toUserId", Sort.Direction.ASC)
                    .on("status", Sort.Direction.ASC).named("ix_settlements_to_status"));
            // the same sender can never create two settlements with the same Idempotency-Key
            settlements.createIndex(new Index().on("fromUserId", Sort.Direction.ASC)
                    .on("idempotencyKey", Sort.Direction.ASC)
                    .unique().named("uk_settlements_from_idempotencyKey")
                    .partial(PartialIndexFilter.of(Criteria.where("idempotencyKey").exists(true))));
        };
    }
}
