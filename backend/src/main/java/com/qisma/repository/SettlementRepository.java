package com.qisma.repository;

import com.qisma.enums.SettlementStatus;
import com.qisma.model.Settlement;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface SettlementRepository extends MongoRepository<Settlement, String> {

    List<Settlement> findByGroupIdAndStatus(String groupId, SettlementStatus status);

    Optional<Settlement> findByIdAndGroupId(String id, String groupId);

    Optional<Settlement> findByFromUserIdAndIdempotencyKey(String fromUserId, String idempotencyKey);
}
