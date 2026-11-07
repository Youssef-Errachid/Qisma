package com.qisma.repository;

import com.qisma.enums.SettlementStatus;
import com.qisma.model.Settlement;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface SettlementRepository extends MongoRepository<Settlement, String> {

    List<Settlement> findByGroupIdAndStatus(String groupId, SettlementStatus status);
}
