package com.qisma.service.impl;

import com.qisma.enums.ExpenseCategory;
import com.qisma.enums.ExpenseStatus;
import com.qisma.enums.SplitMethod;
import com.qisma.model.Expense;
import com.qisma.model.ExpenseShare;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ExpenseSnapshotsTest {

    private static Expense expense() {
        Expense e = new Expense();
        e.setTitle("Grocery");
        e.setAmountMinor(30000);
        e.setCurrency("MAD");
        e.setPaidBy("youssef");
        e.setCategory(ExpenseCategory.FOOD);
        e.setSplitMethod(SplitMethod.PERCENTAGE);
        e.setExpenseDate(LocalDate.parse("2026-11-07"));
        e.setStatus(ExpenseStatus.ACTIVE);
        e.setShares(new ArrayList<>(List.of(new ExpenseShare("youssef", 20000, 6667), new ExpenseShare("ahmed", 10000, 3333))));
        return e;
    }

    @Test
    void capturesEveryFinancialField_withTextualEnumsAndDate() {
        Map<String, Object> s = ExpenseSnapshots.of(expense());

        assertEquals(30000L, s.get("amountMinor"));
        assertEquals("FOOD", s.get("category"));
        assertEquals("PERCENTAGE", s.get("splitMethod"));
        assertEquals("2026-11-07", s.get("expenseDate"));
        assertEquals("ACTIVE", s.get("status"));
        assertEquals(2, ((List<?>) s.get("shares")).size());
    }

    @Test
    void isADetachedCopy_laterChangesDoNotAlterIt() {
        Expense e = expense();
        Map<String, Object> before = ExpenseSnapshots.of(e);

        e.setAmountMinor(99999);
        e.setStatus(ExpenseStatus.DELETED);
        e.setShares(List.of(new ExpenseShare("hamza", 99999, null)));

        assertEquals(30000L, before.get("amountMinor"));
        assertEquals("ACTIVE", before.get("status"));
        @SuppressWarnings("unchecked")
        Map<String, Object> firstShare = ((List<Map<String, Object>>) before.get("shares")).get(0);
        assertEquals("youssef", firstShare.get("userId"));
    }

    @Test
    void sharesKeepTheirAmountsAndPercentages() {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> shares = (List<Map<String, Object>>) ExpenseSnapshots.of(expense()).get("shares");

        assertEquals(20000L, shares.get(0).get("shareMinor"));
        assertEquals(6667, shares.get(0).get("percentageBp"));
    }
}
