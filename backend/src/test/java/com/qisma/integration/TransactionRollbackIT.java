package com.qisma.integration;

import com.qisma.dto.request.CreateSettlementRequest;
import com.qisma.service.ActivityLogService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

/**
 * If the last step of an operation fails (here: writing the history line), EVERYTHING before it must disappear:
 * the expense or settlement, and the ledger counter. Unit tests with mocks cannot show that; a real transaction can.
 */
class TransactionRollbackIT extends IntegrationTestSupport {

    @MockitoSpyBean
    ActivityLogService activityLog;

    private void historyWritingFails() {
        doThrow(new IllegalStateException("history unavailable"))
                .when(activityLog).record(any(), any(), any(), any(), any(), any());
    }

    @Test
    void anExpenseWhoseHistoryCannotBeWritten_leavesNothingBehind() {
        Fixture f = newGroup();
        historyWritingFails();

        assertThrows(IllegalStateException.class, () ->
                expenseService.create(f.owner(), f.groupId(), expense(f.owner(), 30000, f.owner(), f.ahmed(), f.hamza())));

        assertEquals(0L, count("expenses", f.groupId()), "the expense must have been rolled back");
        assertEquals(0L, ledgerVersion(f.groupId()), "the ledger counter must have been rolled back");
        assertEquals(0L, count("activityLogs", f.groupId()));
    }

    @Test
    void afterAFailedOperation_theNextOneWorksNormally() {
        Fixture f = newGroup();
        historyWritingFails();
        assertThrows(IllegalStateException.class, () ->
                expenseService.create(f.owner(), f.groupId(), expense(f.owner(), 30000, f.owner(), f.ahmed(), f.hamza())));

        Mockito.reset(activityLog);
        ownerPaysForEveryone(f, 30000);

        assertEquals(1L, count("expenses", f.groupId()));
        assertEquals(1L, ledgerVersion(f.groupId()));
        assertEquals(1L, count("activityLogs", f.groupId()));
    }

    @Test
    void aSettlementWhoseHistoryCannotBeWritten_leavesNothingBehind() {
        Fixture f = newGroup();
        ownerPaysForEveryone(f, 30000);
        long versionBefore = ledgerVersion(f.groupId());
        historyWritingFails();

        assertThrows(IllegalStateException.class, () ->
                settlementCommands.create(f.ahmed(), f.groupId(), null, new CreateSettlementRequest(f.owner(), 5000L, "x")));

        assertEquals(0L, count("settlements", f.groupId()), "the settlement must have been rolled back");
        assertEquals(versionBefore, ledgerVersion(f.groupId()), "the ledger counter must have been rolled back");
    }

    @Test
    void aConfirmationWhoseHistoryCannotBeWritten_leavesTheSettlementPending() {
        Fixture f = newGroup();
        ownerPaysForEveryone(f, 30000);
        String settlementId = settlementCommands.create(f.ahmed(), f.groupId(), null,
                new CreateSettlementRequest(f.owner(), 5000L, "x")).response().id();
        historyWritingFails();

        assertThrows(IllegalStateException.class, () -> settlementCommands.confirm(f.owner(), f.groupId(), settlementId));

        assertEquals("PENDING", settlements.findById(settlementId).orElseThrow().getStatus().name(),
                "a failed confirmation must not leave the money half-moved");
        assertNull(settlements.findById(settlementId).orElseThrow().getConfirmedAt());
    }
}
