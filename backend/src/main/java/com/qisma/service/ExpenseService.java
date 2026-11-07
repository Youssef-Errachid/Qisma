package com.qisma.service;

import com.qisma.dto.request.CreateExpenseRequest;
import com.qisma.dto.response.ExpenseResponse;

public interface ExpenseService {

    ExpenseResponse create(String userId, String groupId, CreateExpenseRequest request);
}
