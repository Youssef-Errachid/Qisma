package com.qisma.repository;

import com.qisma.dto.request.ExpenseSearchCriteria;
import com.qisma.model.Expense;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ExpenseQueryStore {

    /** ACTIVE expenses of one group that match the criteria, in the order and window given by the pageable. */
    Page<Expense> search(String groupId, ExpenseSearchCriteria criteria, Pageable pageable);
}
