package com.qisma.config;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;

/** Indexes of the history collection. Idempotent. */
@Configuration
public class ActivityIndexConfig {

    @Bean
    ApplicationRunner createActivityIndexes(MongoTemplate mongo) {
        return args -> {
            var logs = mongo.indexOps("activityLogs");
            logs.createIndex(new Index().on("groupId", Sort.Direction.ASC)
                    .on("createdAt", Sort.Direction.DESC).named("ix_activity_group_createdAt"));
            logs.createIndex(new Index().on("groupId", Sort.Direction.ASC)
                    .on("entityType", Sort.Direction.ASC)
                    .on("entityId", Sort.Direction.ASC)
                    .on("createdAt", Sort.Direction.DESC).named("ix_activity_group_entity"));
            logs.createIndex(new Index().on("groupId", Sort.Direction.ASC)
                    .on("actorId", Sort.Direction.ASC)
                    .on("createdAt", Sort.Direction.DESC).named("ix_activity_group_actor"));
        };
    }
}
