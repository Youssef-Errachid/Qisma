package com.qisma.integration;

import com.qisma.dto.request.UpdateGroupRequest;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import com.qisma.model.Expense;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;

import static org.junit.jupiter.api.Assertions.*;

/** The currency may change only while a group has no money in it. This is where that was found to be wrong once. */
class CurrencyLockIT extends IntegrationTestSupport {

    @Test
    void theCurrencyChangesFreely_whileTheGroupHasNoMoney_andDoesNotUseUpTheCounter() {
        Fixture f = newGroupWithOwnerOnly();

        assertEquals("EUR", lifecycle.update(f.owner(), f.groupId(), new UpdateGroupRequest("IT group", null, "EUR")).currency());
        assertEquals("MAD", lifecycle.update(f.owner(), f.groupId(), new UpdateGroupRequest("IT group", null, "MAD")).currency());
        assertEquals("USD", lifecycle.update(f.owner(), f.groupId(), new UpdateGroupRequest("IT group", null, "usd")).currency());

        assertEquals("USD", groups.findById(f.groupId()).orElseThrow().getCurrency());
        assertEquals(0L, ledgerVersion(f.groupId()), "changing the currency is not a financial operation");
    }

    @Test
    void theCurrencyIsLockedByTheFirstExpense_andNothingIsChanged() {
        Fixture f = newGroupWithOwnerOnly();
        expenseService.create(f.owner(), f.groupId(), expense(f.owner(), 1000, f.owner()));

        ApiException e = assertThrows(ApiException.class, () ->
                lifecycle.update(f.owner(), f.groupId(), new UpdateGroupRequest("Renamed", null, "EUR")));

        assertEquals(ErrorCode.CURRENCY_LOCKED, e.getCode());
        assertEquals("MAD", groups.findById(f.groupId()).orElseThrow().getCurrency());
        assertEquals("IT group", groups.findById(f.groupId()).orElseThrow().getName(),
                "the refused update must not have renamed the group either");
    }

    @Test
    void renamingStaysPossible_afterTheCurrencyIsLocked() {
        Fixture f = newGroupWithOwnerOnly();
        expenseService.create(f.owner(), f.groupId(), expense(f.owner(), 1000, f.owner()));

        lifecycle.update(f.owner(), f.groupId(), new UpdateGroupRequest("Renamed", "new text", "MAD"));

        assertEquals("Renamed", groups.findById(f.groupId()).orElseThrow().getName());
    }

    @Test
    void renamingNeverResetsTheLedgerCounter() {
        Fixture f = newGroupWithOwnerOnly();
        expenseService.create(f.owner(), f.groupId(), expense(f.owner(), 1000, f.owner()));
        expenseService.create(f.owner(), f.groupId(), expense(f.owner(), 2000, f.owner()));
        long before = ledgerVersion(f.groupId());

        lifecycle.update(f.owner(), f.groupId(), new UpdateGroupRequest("Renamed", null, null));

        assertEquals(2L, before);
        assertEquals(before, ledgerVersion(f.groupId()));
    }

    @Test
    void race_noExpenseEverEndsUpInADifferentCurrencyThanItsGroup() throws Exception {
        int bothWon = 0;
        int lockedOut = 0;
        for (int round = 0; round < 25; round++) {
            Fixture f = newGroupWithOwnerOnly();
            List<Callable<?>> tasks = new ArrayList<>();
            tasks.add(() -> lifecycle.update(f.owner(), f.groupId(), new UpdateGroupRequest("IT group", null, "EUR")));
            tasks.add(() -> expenseService.create(f.owner(), f.groupId(), expense(f.owner(), 1000, f.owner())));

            List<Outcome> outcomes = runTogether(tasks);

            outcomes.stream().filter(o -> !o.ok())
                    .forEach(o -> assertAcceptable(o.error(), ErrorCode.CURRENCY_LOCKED));

            String finalCurrency = groups.findById(f.groupId()).orElseThrow().getCurrency();
            for (Expense e : expensesOf(f.groupId())) {
                assertEquals(finalCurrency, e.getCurrency(),
                        "round " + round + ": an expense was recorded in a currency the group no longer uses");
            }
            if (outcomes.stream().allMatch(Outcome::ok)) {
                bothWon++;
            }
            if (!outcomes.get(0).ok() && !isLostRace(outcomes.get(0).error())) {
                lockedOut++;
            }
        }
        System.out.printf("[CurrencyLockIT] 25 races: both succeeded in order %d, currency change refused as locked %d%n",
                bothWon, lockedOut);
    }
}
