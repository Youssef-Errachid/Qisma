package com.qisma.repository;

import com.qisma.enums.ExpenseStatus;
import com.qisma.model.Expense;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ExpenseRepository extends MongoRepository<Expense, String> {

    Optional<Expense> findByIdAndGroupId(String id, String groupId);

    /** Everything the ledger needs to compute balances. */
    List<Expense> findByGroupIdAndStatus(String groupId, ExpenseStatus status);

    long countByGroupIdAndStatus(String groupId, ExpenseStatus status);
}
