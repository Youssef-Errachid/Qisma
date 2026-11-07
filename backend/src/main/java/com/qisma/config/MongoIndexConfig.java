package com.qisma.config;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.data.mongodb.core.query.Collation;
import org.springframework.data.mongodb.core.query.Criteria;

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

            var groups = mongo.indexOps("groups");
            groups.createIndex(new Index().on("ownerId", Sort.Direction.ASC).named("ix_groups_ownerId"));

            var memberships = mongo.indexOps("memberships");
            memberships.createIndex(new Index().on("groupId", Sort.Direction.ASC)
                    .on("userId", Sort.Direction.ASC)
                    .unique().named("uk_memberships_group_user"));
            memberships.createIndex(new Index().on("userId", Sort.Direction.ASC)
                    .on("status", Sort.Direction.ASC).named("ix_memberships_user_status"));
            memberships.createIndex(new Index().on("groupId", Sort.Direction.ASC)
                    .on("status", Sort.Direction.ASC).named("ix_memberships_group_status"));
            // at most ONE active owner per group, enforced by the database itself
            memberships.createIndex(new Index().on("groupId", Sort.Direction.ASC)
                    .unique().named("uk_memberships_single_active_owner")
                    .partial(PartialIndexFilter.of(Criteria.where("role").is("OWNER").and("status").is("ACTIVE"))));

            var invitations = mongo.indexOps("invitations");
            invitations.createIndex(new Index().on("secretHash", Sort.Direction.ASC)
                    .unique().named("uk_invitations_secretHash"));
            invitations.createIndex(new Index().on("groupId", Sort.Direction.ASC)
                    .on("status", Sort.Direction.ASC).named("ix_invitations_group_status"));
        };
    }
}
