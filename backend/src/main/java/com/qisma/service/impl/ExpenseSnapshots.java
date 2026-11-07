package com.qisma.service.impl;

import com.qisma.model.Expense;
import com.qisma.model.ExpenseShare;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** A deep, detached copy of an expense for the history: later changes to the entity never alter it. */
final class ExpenseSnapshots {

    private ExpenseSnapshots() {
    }

    static Map<String, Object> of(Expense e) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("title", e.getTitle());
        snapshot.put("description", e.getDescription());
        snapshot.put("amountMinor", e.getAmountMinor());
        snapshot.put("currency", e.getCurrency());
        snapshot.put("paidBy", e.getPaidBy());
        snapshot.put("category", e.getCategory() == null ? null : e.getCategory().name());
        snapshot.put("splitMethod", e.getSplitMethod() == null ? null : e.getSplitMethod().name());
        snapshot.put("expenseDate", e.getExpenseDate() == null ? null : e.getExpenseDate().toString());
        snapshot.put("status", e.getStatus() == null ? null : e.getStatus().name());

        List<Map<String, Object>> shares = new ArrayList<>();
        for (ExpenseShare share : e.getShares()) {
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("userId", share.userId());
            s.put("shareMinor", share.shareMinor());
            s.put("percentageBp", share.percentageBp());
            shares.add(s);
        }
        snapshot.put("shares", shares);
        return snapshot;
    }
}
