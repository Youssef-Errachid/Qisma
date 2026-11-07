package com.qisma.service;

import com.qisma.dto.request.ExpenseSearchCriteria;
import com.qisma.dto.response.ExpenseResponse;
import com.qisma.dto.response.PageResponse;

public interface ExpenseQueryService {

    PageResponse<ExpenseResponse> list(String userId, String groupId, ExpenseSearchCriteria criteria,
                                       int page, int size);

    ExpenseResponse get(String userId, String groupId, String expenseId);
}
