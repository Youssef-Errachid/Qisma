package com.qisma.service.impl;

import com.qisma.dto.request.CreateExpenseRequest;
import com.qisma.enums.MembershipStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.model.ExpenseShare;
import com.qisma.model.Membership;
import com.qisma.repository.MembershipRepository;
import com.qisma.service.finance.InvalidSplitException;
import com.qisma.service.finance.Money;
import com.qisma.service.finance.ShareAllocation;
import com.qisma.service.finance.ShareInput;
import com.qisma.service.finance.SplitStrategyFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * The rules shared by creating and updating an expense: currency, who may pay or take part, and the
 * server-side computation of every share. Used so that both paths can never drift apart.
 */
@Component
public class ExpenseAllocator {

    private final MembershipRepository memberships;
    private final SplitStrategyFactory splitFactory;

    public ExpenseAllocator(MembershipRepository memberships, SplitStrategyFactory splitFactory) {
        this.memberships = memberships;
        this.splitFactory = splitFactory;
    }

    public List<ExpenseShare> allocate(String groupId, String groupCurrency, CreateExpenseRequest request) {
        if (request.currency() != null && !request.currency().trim().equalsIgnoreCase(groupCurrency)) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Expense currency must be " + groupCurrency);
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
                    .allocate(Money.of(request.amountMinor(), groupCurrency), inputs);
        } catch (InvalidSplitException e) {
            throw new ApiException(ErrorCode.INVALID_SPLIT, e.getMessage());
        }

        return allocations.stream()
                .map(a -> new ExpenseShare(a.userId(), a.shareMinor(), a.percentageBp()))
                .toList();
    }
}
