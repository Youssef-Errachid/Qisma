package com.qisma.config;

import com.mongodb.client.model.Collation;
import com.mongodb.client.model.CollationStrength;
import org.bson.Document;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;

/** Creates indexes explicitly (auto-index-creation is off by default). Idempotent. */
@Configuration
public class MongoIndexConfig {

    @Bean
    ApplicationRunner createIndexes(MongoTemplate mongo) {
        return args -> {
            var users = mongo.indexOps("users");
            users.createIndex(new Index().on("email", org.springframework.data.domain.Sort.Direction.ASC)
                    .unique().named("uk_users_email"));
            users.createIndex(new Index().on("username", org.springframework.data.domain.Sort.Direction.ASC)
                    .unique().named("uk_users_username_ci")
                    .collation(org.springframework.data.mongodb.core.query.Collation.of("en")
                            .strength(org.springframework.data.mongodb.core.query.Collation.ComparisonLevel.secondary())));
        };
    }
}
