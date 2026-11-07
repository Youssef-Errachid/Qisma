package com.qisma.service.impl;

import com.qisma.dto.request.CreateExpenseRequest;
import com.qisma.dto.request.UpdateExpenseRequest;
import com.qisma.dto.response.ExpenseResponse;
import com.qisma.enums.ActivityAction;
import com.qisma.enums.ExpenseStatus;
import com.qisma.enums.GroupRole;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.mapper.ExpenseMapper;
import com.qisma.model.Expense;
import com.qisma.model.ExpenseShare;
import com.qisma.repository.ExpenseRepository;
import com.qisma.repository.GroupLedgerStore;
import com.qisma.security.GroupAccessGuard;
import com.qisma.service.ActivityLogService;
import com.qisma.service.ExpenseService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class ExpenseServiceImpl implements ExpenseService {

    private final ExpenseRepository expenses;
    private final GroupAccessGuard guard;
    private final ExpenseAllocator allocator;
    private final GroupLedgerStore ledger;
    private final ActivityLogService activity;
    private final ExpenseMapper mapper;
    private final Clock clock;

    public ExpenseServiceImpl(ExpenseRepository expenses, GroupAccessGuard guard, ExpenseAllocator allocator,
                              GroupLedgerStore ledger, ActivityLogService activity,
                              ExpenseMapper mapper, Clock clock) {
        this.expenses = expenses;
        this.guard = guard;
        this.allocator = allocator;
        this.ledger = ledger;
        this.activity = activity;
        this.mapper = mapper;
        this.clock = clock;
    }

    /**
     * The server computes every share itself. The expense, the group's ledgerVersion bump and the history
     * line are saved in ONE transaction.
     */
    @Override
    @Transactional
    public ExpenseResponse create(String userId, String groupId, CreateExpenseRequest request) {
        GroupAccessGuard.Access access = guard.forWrite(groupId, userId);
        String currency = access.group().getCurrency();
        List<ExpenseShare> shares = allocator.allocate(groupId, currency, request);

        Expense expense = new Expense();
        expense.setGroupId(groupId);
        expense.setTitle(request.title().trim());
        expense.setDescription(blankToNull(request.description()));
        expense.setAmountMinor(request.amountMinor());
        expense.setCurrency(currency);
        expense.setPaidBy(request.paidBy());
        expense.setCategory(request.category());
        expense.setSplitMethod(request.splitMethod());
        expense.setShares(shares);
        expense.setExpenseDate(request.expenseDate());
        expense.setStatus(ExpenseStatus.ACTIVE);
        expense.setCreatedBy(userId);
        expense.setCreatedAt(clock.instant());

        Expense saved = expenses.save(expense);
        ledger.advance(groupId);
        activity.record(groupId, userId, ActivityAction.EXPENSE_CREATED, saved.getId(),
                null, ExpenseSnapshots.of(saved));
        return mapper.toResponse(saved);
    }

    @Override
    @Transactional
    public ExpenseResponse update(String userId, String groupId, String expenseId, UpdateExpenseRequest request) {
        GroupAccessGuard.Access access = guard.forWrite(groupId, userId);
        Expense expense = loadActive(groupId, expenseId);
        requireCanModify(access, expense, userId);

        if (!Objects.equals(request.version(), expense.getVersion())) {
            throw new ApiException(ErrorCode.VERSION_CONFLICT,
                    "The expense was changed by someone else. Reload it and try again");
        }

        List<ExpenseShare> shares = allocator.allocate(groupId, access.group().getCurrency(),
                request.toCreateRequest());

        Map<String, Object> before = ExpenseSnapshots.of(expense);
        expense.setTitle(request.title().trim());
        expense.setDescription(blankToNull(request.description()));
        expense.setAmountMinor(request.amountMinor());
        expense.setPaidBy(request.paidBy());
        expense.setCategory(request.category());
        expense.setSplitMethod(request.splitMethod());
        expense.setShares(shares);
        expense.setExpenseDate(request.expenseDate());
        expense.setUpdatedBy(userId);
        expense.setUpdatedAt(clock.instant());

        // a concurrent change between the load and this save makes the @Version check fail (409)
        Expense saved = expenses.save(expense);
        ledger.advance(groupId);
        activity.record(groupId, userId, ActivityAction.EXPENSE_UPDATED, saved.getId(),
                before, ExpenseSnapshots.of(saved));
        return mapper.toResponse(saved);
    }

    @Override
    @Transactional
    public void delete(String userId, String groupId, String expenseId) {
        GroupAccessGuard.Access access = guard.forWrite(groupId, userId);
        Expense expense = loadActive(groupId, expenseId);
        requireCanModify(access, expense, userId);

        Map<String, Object> before = ExpenseSnapshots.of(expense);
        Instant now = clock.instant();
        expense.setStatus(ExpenseStatus.DELETED);
        expense.setDeletedBy(userId);
        expense.setDeletedAt(now);
        expense.setUpdatedBy(userId);
        expense.setUpdatedAt(now);

        Expense saved = expenses.save(expense);
        ledger.advance(groupId);
        activity.record(groupId, userId, ActivityAction.EXPENSE_DELETED, saved.getId(),
                before, ExpenseSnapshots.of(saved));
    }

    private Expense loadActive(String groupId, String expenseId) {
        return expenses.findByIdAndGroupId(expenseId, groupId)
                .filter(e -> e.getStatus() == ExpenseStatus.ACTIVE)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Expense not found"));
    }

    /** The creator and the group owner (as moderator) may change an expense; other members may not. */
    private static void requireCanModify(GroupAccessGuard.Access access, Expense expense, String userId) {
        boolean isCreator = userId.equals(expense.getCreatedBy());
        boolean isOwner = access.membership().getRole() == GroupRole.OWNER;
        if (!isCreator && !isOwner) {
            throw new ApiException(ErrorCode.FORBIDDEN,
                    "Only the creator of the expense or the group owner can change it");
        }
    }

    private static String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }
}
