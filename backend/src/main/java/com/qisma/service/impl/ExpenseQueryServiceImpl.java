package com.qisma.service.impl;

import com.qisma.dto.request.ExpenseSearchCriteria;
import com.qisma.dto.response.ExpenseResponse;
import com.qisma.dto.response.PageResponse;
import com.qisma.enums.ExpenseStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.mapper.ExpenseMapper;
import com.qisma.model.Expense;
import com.qisma.repository.ExpenseQueryStore;
import com.qisma.repository.ExpenseRepository;
import com.qisma.security.GroupAccessGuard;
import com.qisma.service.ExpenseQueryService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ExpenseQueryServiceImpl implements ExpenseQueryService {

    static final int MAX_PAGE_SIZE = 100;
    static final int MAX_SEARCH_LENGTH = 100;
    /** Newest first; the id makes the order fully deterministic between pages. */
    static final Sort DEFAULT_SORT = Sort.by(
            Sort.Order.desc("expenseDate"), Sort.Order.desc("createdAt"), Sort.Order.desc("_id"));

    private final ExpenseRepository expenses;
    private final ExpenseQueryStore store;
    private final GroupAccessGuard guard;
    private final ExpenseMapper mapper;

    public ExpenseQueryServiceImpl(ExpenseRepository expenses, ExpenseQueryStore store,
                                   GroupAccessGuard guard, ExpenseMapper mapper) {
        this.expenses = expenses;
        this.store = store;
        this.guard = guard;
        this.mapper = mapper;
    }

    @Override
    public PageResponse<ExpenseResponse> list(String userId, String groupId, ExpenseSearchCriteria criteria,
                                              int page, int size) {
        guard.forRead(groupId, userId);

        if (page < 0 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED,
                    "Invalid pagination: page must be >= 0 and size between 1 and " + MAX_PAGE_SIZE);
        }
        if (criteria.from() != null && criteria.to() != null && criteria.from().isAfter(criteria.to())) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "'from' must not be after 'to'");
        }
        String q = blankToNull(criteria.q());
        if (q != null && q.length() > MAX_SEARCH_LENGTH) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED,
                    "Search text must not exceed " + MAX_SEARCH_LENGTH + " characters");
        }

        ExpenseSearchCriteria normalized = new ExpenseSearchCriteria(criteria.from(), criteria.to(),
                criteria.category(), blankToNull(criteria.paidBy()), blankToNull(criteria.participant()), q);

        Page<Expense> result = store.search(groupId, normalized, PageRequest.of(page, size, DEFAULT_SORT));
        List<ExpenseResponse> items = result.getContent().stream().map(mapper::toResponse).toList();
        return new PageResponse<>(items, result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
    }

    @Override
    public ExpenseResponse get(String userId, String groupId, String expenseId) {
        guard.forRead(groupId, userId);
        return expenses.findByIdAndGroupId(expenseId, groupId)
                .filter(e -> e.getStatus() == ExpenseStatus.ACTIVE)
                .map(mapper::toResponse)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Expense not found"));
    }

    private static String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }
}
