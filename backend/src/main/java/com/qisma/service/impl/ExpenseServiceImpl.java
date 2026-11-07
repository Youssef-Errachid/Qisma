package com.qisma.service.impl;

import com.qisma.dto.request.CreateExpenseRequest;
import com.qisma.dto.response.ExpenseResponse;
import com.qisma.enums.ExpenseStatus;
import com.qisma.enums.MembershipStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.mapper.ExpenseMapper;
import com.qisma.model.Expense;
import com.qisma.model.ExpenseShare;
import com.qisma.model.Membership;
import com.qisma.repository.ExpenseRepository;
import com.qisma.repository.GroupLedgerStore;
import com.qisma.repository.MembershipRepository;
import com.qisma.security.GroupAccessGuard;
import com.qisma.service.ExpenseService;
import com.qisma.service.finance.InvalidSplitException;
import com.qisma.service.finance.Money;
import com.qisma.service.finance.ShareAllocation;
import com.qisma.service.finance.ShareInput;
import com.qisma.service.finance.SplitStrategyFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ExpenseServiceImpl implements ExpenseService {

    private final ExpenseRepository expenses;
    private final MembershipRepository memberships;
    private final GroupAccessGuard guard;
    private final SplitStrategyFactory splitFactory;
    private final GroupLedgerStore ledger;
    private final ExpenseMapper mapper;
    private final Clock clock;

    public ExpenseServiceImpl(ExpenseRepository expenses, MembershipRepository memberships,
                              GroupAccessGuard guard, SplitStrategyFactory splitFactory,
                              GroupLedgerStore ledger, ExpenseMapper mapper, Clock clock) {
        this.expenses = expenses;
        this.memberships = memberships;
        this.guard = guard;
        this.splitFactory = splitFactory;
        this.ledger = ledger;
        this.mapper = mapper;
        this.clock = clock;
    }

    /**
     * The server computes every share itself; the client never sends a final share for EQUAL splits and
     * its figures for CUSTOM/PERCENTAGE are validated against the total. Saved in one transaction together
     * with the group's ledgerVersion bump.
     */
    @Override
    @Transactional
    public ExpenseResponse create(String userId, String groupId, CreateExpenseRequest request) {
        GroupAccessGuard.Access access = guard.forWrite(groupId, userId);
        String currency = access.group().getCurrency();

        if (request.currency() != null && !request.currency().trim().equalsIgnoreCase(currency)) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Expense currency must be " + currency);
        }

        Set<String> activeMembers = memberships.findByGroupIdAndStatus(groupId, MembershipStatus.ACTIVE).stream()
                .map(Membership::getUserId)
                .collect(Collectors.toSet());

        if (!activeMembers.contains(request.paidBy())) {
            throw new ApiException(ErrorCode.PARTICIPANT_NOT_MEMBER, "The payer is not an active member of this group");
        }
        request.participants().forEach(p -> {
            if (!activeMembers.contains(p.userId())) {
                throw new ApiException(ErrorCode.PARTICIPANT_NOT_MEMBER,
                        "A participant is not an active member of this group");
            }
        });

        List<ShareAllocation> allocations;
        try {
            List<ShareInput> inputs = request.participants().stream()
                    .map(p -> new ShareInput(p.userId(), p.shareMinor(), p.percentageBp()))
                    .toList();
            allocations = splitFactory.forMethod(request.splitMethod())
                    .allocate(Money.of(request.amountMinor(), currency), inputs);
        } catch (InvalidSplitException e) {
            throw new ApiException(ErrorCode.INVALID_SPLIT, e.getMessage());
        }

        Expense expense = new Expense();
        expense.setGroupId(groupId);
        expense.setTitle(request.title().trim());
        expense.setDescription(blankToNull(request.description()));
        expense.setAmountMinor(request.amountMinor());
        expense.setCurrency(currency);
        expense.setPaidBy(request.paidBy());
        expense.setCategory(request.category());
        expense.setSplitMethod(request.splitMethod());
        expense.setShares(allocations.stream()
                .map(a -> new ExpenseShare(a.userId(), a.shareMinor(), a.percentageBp()))
                .toList());
        expense.setExpenseDate(request.expenseDate());
        expense.setStatus(ExpenseStatus.ACTIVE);
        expense.setCreatedBy(userId);
        expense.setCreatedAt(clock.instant());

        Expense saved = expenses.save(expense);
        ledger.advance(groupId);
        return mapper.toResponse(saved);
    }

    private static String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }
}
