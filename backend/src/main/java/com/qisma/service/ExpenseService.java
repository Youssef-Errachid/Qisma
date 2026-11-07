package com.qisma.service;

import com.qisma.dto.request.CreateExpenseRequest;
import com.qisma.dto.request.UpdateExpenseRequest;
import com.qisma.dto.response.ExpenseResponse;

public interface ExpenseService {

    ExpenseResponse create(String userId, String groupId, CreateExpenseRequest request);

    /** Allowed for the creator of the expense and for the group owner. */
    ExpenseResponse update(String userId, String groupId, String expenseId, UpdateExpenseRequest request);

    /** Logical deletion; allowed for the creator of the expense and for the group owner. */
    void delete(String userId, String groupId, String expenseId);
}
