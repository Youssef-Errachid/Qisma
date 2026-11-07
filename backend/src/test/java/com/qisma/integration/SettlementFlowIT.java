package com.qisma.integration;

import com.qisma.dto.request.CreateSettlementRequest;
import com.qisma.dto.response.BalancesResponse;
import com.qisma.dto.response.MemberBalanceResponse;
import com.qisma.enums.MembershipStatus;
import com.qisma.exception.ApiException;
import com.qisma.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** The whole money cycle through the real services and a real database. */
class SettlementFlowIT extends IntegrationTestSupport {

    private long netOf(BalancesResponse balances, String userId) {
        return balances.members().stream().filter(m -> m.userId().equals(userId))
                .findFirst().map(MemberBalanceResponse::netMinor).orElseThrow();
    }

    @Test
    void expenseThenSettlements_bringEveryBalanceBackToZero() {
        Fixture f = newGroup();
        ownerPaysForEveryone(f, 30000);

        BalancesResponse start = balanceService.getBalances(f.owner(), f.groupId());
        assertEquals(20000L, netOf(start, f.owner()));
        assertEquals(-10000L, netOf(start, f.ahmed()));
        assertEquals(-10000L, netOf(start, f.hamza()));
        assertEquals(0L, start.sumMinor());

        String a = settlementCommands.create(f.ahmed(), f.groupId(), null, new CreateSettlementRequest(f.owner(), 10000L, null))
                .response().id();
        String h = settlementCommands.create(f.hamza(), f.groupId(), null, new CreateSettlementRequest(f.owner(), 10000L, null))
                .response().id();

        // declared but not confirmed: nothing moves yet, but the effective position already does
        BalancesResponse pending = balanceService.getBalances(f.owner(), f.groupId());
        assertEquals(-10000L, netOf(pending, f.ahmed()));
        assertEquals(0L, pending.members().stream().filter(m -> m.userId().equals(f.ahmed()))
                .findFirst().orElseThrow().effectiveNetMinor());

        settlementCommands.confirm(f.owner(), f.groupId(), a);
        settlementCommands.confirm(f.owner(), f.groupId(), h);

        BalancesResponse end = balanceService.getBalances(f.owner(), f.groupId());
        end.members().forEach(m -> assertEquals(0L, m.netMinor(), m.userId()));
        assertEquals(0L, end.sumMinor());
    }

    @Test
    void aRejectedSettlement_neverTouchesTheBalances() {
        Fixture f = newGroup();
        ownerPaysForEveryone(f, 30000);
        String id = settlementCommands.create(f.ahmed(), f.groupId(), null, new CreateSettlementRequest(f.owner(), 10000L, null))
                .response().id();

        settlementCommands.reject(f.owner(), f.groupId(), id, "not received");

        BalancesResponse balances = balanceService.getBalances(f.owner(), f.groupId());
        assertEquals(-10000L, netOf(balances, f.ahmed()));
        assertEquals(-10000L, balances.members().stream().filter(m -> m.userId().equals(f.ahmed()))
                .findFirst().orElseThrow().effectiveNetMinor(), "a rejected settlement no longer counts as pending");
    }

    @Test
    void aMemberCanLeaveOnlyOnceSettled_andThenStaysReadOnly() {
        Fixture f = newGroup();
        ownerPaysForEveryone(f, 30000);

        ApiException owes = assertThrows(ApiException.class, () -> lifecycle.leave(f.hamza(), f.groupId()));
        assertEquals(ErrorCode.BALANCE_NOT_SETTLED, owes.getCode());

        String id = settlementCommands.create(f.hamza(), f.groupId(), null, new CreateSettlementRequest(f.owner(), 10000L, null))
                .response().id();
        ApiException pending = assertThrows(ApiException.class, () -> lifecycle.leave(f.hamza(), f.groupId()));
        assertEquals(ErrorCode.PENDING_SETTLEMENTS, pending.getCode());

        settlementCommands.confirm(f.owner(), f.groupId(), id);
        lifecycle.leave(f.hamza(), f.groupId());

        assertEquals(MembershipStatus.INACTIVE,
                memberships.findByGroupIdAndUserId(f.groupId(), f.hamza()).orElseThrow().getStatus());
        assertDoesNotThrow(() -> balanceService.getBalances(f.hamza(), f.groupId()), "a member who left can still read");
        assertEquals(ErrorCode.FORBIDDEN, assertThrows(ApiException.class, () ->
                expenseService.create(f.hamza(), f.groupId(), expense(f.hamza(), 100, f.hamza()))).getCode());
    }

    @Test
    void aMemberDeactivatedWithADebt_canStillSettleIt() {
        Fixture f = newGroup();
        ownerPaysForEveryone(f, 30000);

        lifecycle.deactivateMember(f.owner(), f.groupId(), f.ahmed());

        String id = settlementCommands.create(f.ahmed(), f.groupId(), null, new CreateSettlementRequest(f.owner(), 10000L, null))
                .response().id();
        settlementCommands.confirm(f.owner(), f.groupId(), id);

        assertEquals(0L, netOf(balanceService.getBalances(f.owner(), f.groupId()), f.ahmed()));
    }

    @Test
    void anExpenseThatIsNotInTheGroupCurrency_isRefused_andLeavesNoTrace() {
        Fixture f = newGroupWithOwnerOnly();
        var wrongCurrency = new com.qisma.dto.request.CreateExpenseRequest("x", null, 1000L, "EUR", f.owner(),
                java.time.LocalDate.of(2026, 11, 7), com.qisma.enums.ExpenseCategory.FOOD, com.qisma.enums.SplitMethod.EQUAL,
                java.util.List.of(new com.qisma.dto.request.ParticipantInput(f.owner(), null, null)));

        assertEquals(ErrorCode.VALIDATION_FAILED, assertThrows(ApiException.class,
                () -> expenseService.create(f.owner(), f.groupId(), wrongCurrency)).getCode());

        assertEquals(0L, count("expenses", f.groupId()));
        assertEquals(0L, ledgerVersion(f.groupId()));
    }
}
