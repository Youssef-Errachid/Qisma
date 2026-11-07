package com.qisma.mapper;

import com.qisma.dto.response.ExpenseResponse;
import com.qisma.dto.response.ExpenseShareResponse;
import com.qisma.model.Expense;
import org.springframework.stereotype.Component;

@Component
public class ExpenseMapper {

    public ExpenseResponse toResponse(Expense e) {
        return new ExpenseResponse(
                e.getId(),
                e.getGroupId(),
                e.getTitle(),
                e.getDescription(),
                e.getAmountMinor(),
                e.getCurrency(),
                e.getPaidBy(),
                e.getCategory(),
                e.getSplitMethod(),
                e.getShares().stream()
                        .map(s -> new ExpenseShareResponse(s.userId(), s.shareMinor(), s.percentageBp()))
                        .toList(),
                e.getExpenseDate(),
                e.getStatus(),
                e.getCreatedBy(),
                e.getCreatedAt(),
                e.getUpdatedAt(),
                e.getVersion());
    }
}
