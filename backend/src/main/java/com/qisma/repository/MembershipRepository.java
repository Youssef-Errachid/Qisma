package com.qisma.repository;

import com.qisma.enums.MembershipStatus;
import com.qisma.model.Membership;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface MembershipRepository extends MongoRepository<Membership, String> {

    Optional<Membership> findByGroupIdAndUserIdAndStatus(String groupId, String userId, MembershipStatus status);

    List<Membership> findByUserIdAndStatus(String userId, MembershipStatus status);

    long countByUserIdAndStatus(String userId, MembershipStatus status);
}
