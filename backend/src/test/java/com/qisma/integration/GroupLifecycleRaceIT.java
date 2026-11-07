package com.qisma.integration;

import com.qisma.dto.request.CreateSettlementRequest;
import com.qisma.dto.request.TransferOwnershipRequest;
import com.qisma.enums.GroupStatus;
import com.qisma.enums.SettlementStatus;
import com.qisma.exception.ErrorCode;
import com.qisma.model.Expense;
import com.qisma.model.ExpenseShare;
import com.qisma.model.Group;
import com.qisma.model.Membership;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;

import static org.junit.jupiter.api.Assertions.*;

/** Each test races two operations whose outcomes must never contradict each other, over many rounds. */
class GroupLifecycleRaceIT extends IntegrationTestSupport {

    private static final int ROUNDS = 20;

    @Test
    void race_aGroupIsNeverArchivedWhileASettlementIsPending() throws Exception {
        for (int round = 0; round < ROUNDS; round++) {
            Fixture f = newGroup();
            ownerPaysForEveryone(f, 30000);

            List<Callable<?>> tasks = new ArrayList<>();
            tasks.add(() -> {
                lifecycle.archive(f.owner(), f.groupId());
                return null;
            });
            tasks.add(() -> settlementCommands.create(f.ahmed(), f.groupId(), null,
                    new CreateSettlementRequest(f.owner(), 5000L, "race")));

            List<Outcome> outcomes = runTogether(tasks);

            outcomes.stream().filter(o -> !o.ok()).forEach(o -> assertAcceptable(o.error(),
                    ErrorCode.PENDING_SETTLEMENTS, ErrorCode.GROUP_ARCHIVED));
            boolean archived = groups.findById(f.groupId()).orElseThrow().getStatus() == GroupStatus.ARCHIVED;
            long pending = settlements.findByGroupIdAndStatus(f.groupId(), SettlementStatus.PENDING).size();
            assertFalse(archived && pending > 0,
                    "round " + round + ": the group was archived with a settlement still pending");
        }
    }

    @Test
    void race_twoOwnershipTransfers_leaveExactlyOneOwner() throws Exception {
        for (int round = 0; round < ROUNDS; round++) {
            Fixture f = newGroup();

            List<Callable<?>> tasks = new ArrayList<>();
            tasks.add(() -> lifecycle.transferOwnership(f.owner(), f.groupId(), new TransferOwnershipRequest(f.ahmed())));
            tasks.add(() -> lifecycle.transferOwnership(f.owner(), f.groupId(), new TransferOwnershipRequest(f.hamza())));

            List<Outcome> outcomes = runTogether(tasks);

            outcomes.stream().filter(o -> !o.ok()).forEach(o -> assertAcceptable(o.error(),
                    ErrorCode.FORBIDDEN, ErrorCode.CONCURRENT_UPDATE));
            assertEquals(1L, activeOwners(f.groupId()), "round " + round + ": the group must have exactly one owner");
            assertTrue(outcomes.stream().filter(Outcome::ok).count() <= 1, "round " + round);

            Group group = groups.findById(f.groupId()).orElseThrow();
            Membership owner = memberships.findByGroupIdAndUserId(f.groupId(), group.getOwnerId()).orElseThrow();
            assertEquals("OWNER", owner.getRole().name(),
                    "round " + round + ": group.ownerId must point to the member who really is the owner");
        }
    }

    @Test
    void theDatabaseItselfRefusesASecondActiveOwner() {
        Fixture f = newGroup();
        Membership other = memberships.findByGroupIdAndUserId(f.groupId(), f.ahmed()).orElseThrow();
        other.setRole(com.qisma.enums.GroupRole.OWNER);

        assertThrows(org.springframework.dao.DuplicateKeyException.class, () -> memberships.save(other),
                "the partial unique index must stop a second ACTIVE owner even if the service had a bug");
    }

    @Test
    void race_aMemberLeaving_andAnExpenseThatIncludesThem_neverContradict() throws Exception {
        for (int round = 0; round < ROUNDS; round++) {
            Fixture f = newGroup();

            List<Callable<?>> tasks = new ArrayList<>();
            tasks.add(() -> {
                lifecycle.leave(f.ahmed(), f.groupId());
                return null;
            });
            tasks.add(() -> expenseService.create(f.owner(), f.groupId(),
                    expense(f.owner(), 3000, f.owner(), f.ahmed(), f.hamza())));

            List<Outcome> outcomes = runTogether(tasks);

            outcomes.stream().filter(o -> !o.ok()).forEach(o -> assertAcceptable(o.error(),
                    ErrorCode.BALANCE_NOT_SETTLED, ErrorCode.PARTICIPANT_NOT_MEMBER, ErrorCode.MEMBER_NOT_ACTIVE));

            boolean left = memberships.findByGroupIdAndUserId(f.groupId(), f.ahmed()).orElseThrow()
                    .getStatus().name().equals("INACTIVE");
            boolean ahmedHasAShare = expensesOf(f.groupId()).stream().map(Expense::getShares)
                    .flatMap(List::stream).map(ExpenseShare::userId).anyMatch(f.ahmed()::equals);
            assertFalse(left && ahmedHasAShare,
                    "round " + round + ": a member left with a balance because an expense slipped in beside the leave");
        }
    }
}
