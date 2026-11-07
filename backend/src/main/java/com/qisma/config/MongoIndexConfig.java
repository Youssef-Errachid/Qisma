package com.qisma.config;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.query.Collation;

/** Creates indexes explicitly (auto-index-creation is off by default). Idempotent. */
@Configuration
public class MongoIndexConfig {

    @Bean
    ApplicationRunner createIndexes(MongoTemplate mongo) {
        return args -> {
            var users = mongo.indexOps("users");
            users.createIndex(new Index().on("email", Sort.Direction.ASC)
                    .unique().named("uk_users_email"));
            users.createIndex(new Index().on("username", Sort.Direction.ASC)
                    .unique().named("uk_users_username_ci")
                    .collation(Collation.of("en").strength(Collation.ComparisonLevel.secondary())));

            var tokens = mongo.indexOps("refreshTokens");
            tokens.createIndex(new Index().on("tokenHash", Sort.Direction.ASC)
                    .unique().named("uk_refresh_tokenHash"));
            tokens.createIndex(new Index().on("familyId", Sort.Direction.ASC).named("ix_refresh_familyId"));
            tokens.createIndex(new Index().on("userId", Sort.Direction.ASC).named("ix_refresh_userId"));
            // MongoDB deletes expired documents by itself
            tokens.createIndex(new Index().on("expiresAt", Sort.Direction.ASC)
                    .expire(0L).named("ttl_refresh_expiresAt"));
        };
    }
}
