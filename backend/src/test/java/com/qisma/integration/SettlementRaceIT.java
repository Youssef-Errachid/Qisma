package com.qisma.integration;

import com.qisma.dto.request.CreateSettlementRequest;
import com.qisma.enums.SettlementStatus;
import com.qisma.exception.ErrorCode;
import com.qisma.model.Settlement;
import com.qisma.service.SettlementResult;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

class SettlementRaceIT extends IntegrationTestSupport {

    @Test
    void simultaneousSettlements_cannotTogetherExceedTheDebt() throws Exception {
        Fixture f = newGroup();
        ownerPaysForEveryone(f, 30000);   // ahmed owes 100.00, the owner is owed 200.00

        List<Callable<?>> tasks = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            String key = "race-" + i + "-" + UUID.randomUUID();
            tasks.add(() -> settlementCommands.create(f.ahmed(), f.groupId(), key,
                    new CreateSettlementRequest(f.owner(), 6000L, "race")));
        }

        List<Outcome> outcomes = runTogether(tasks);

        outcomes.stream().filter(o -> !o.ok()).forEach(o -> assertAcceptable(o.error(), ErrorCode.SETTLEMENT_EXCEEDS_BALANCE));
        long created = outcomes.stream().filter(Outcome::ok).count();
        long pendingTotal = settlements.findByGroupIdAndStatus(f.groupId(), SettlementStatus.PENDING).stream()
                .mapToLong(Settlement::getAmountMinor).sum();

        assertEquals(1L, created, "only one 60.00 settlement fits in a 100.00 debt");
        assertEquals(6000L, pendingTotal);
        System.out.printf("[SettlementRaceIT] 8 simultaneous requests: %d created, %d refused by the balance rules, %d lost the race%n",
                created,
                outcomes.stream().filter(o -> !o.ok() && !isLostRace(o.error())).count(),
                outcomes.stream().filter(o -> !o.ok() && isLostRace(o.error())).count());
    }

    @Test
    void theSameIdempotencyKey_sentManyTimesAtOnce_createsExactlyOneSettlement() throws Exception {
        Fixture f = newGroup();
        ownerPaysForEveryone(f, 30000);
        String key = "same-key-" + UUID.randomUUID();
        CreateSettlementRequest request = new CreateSettlementRequest(f.owner(), 4000L, "once");

        List<Callable<?>> tasks = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            tasks.add(() -> settlementCommands.create(f.ahmed(), f.groupId(), key, request));
        }
        List<Outcome> outcomes = runTogether(tasks);

        outcomes.stream().filter(o -> !o.ok()).forEach(o -> assertAcceptable(o.error()));
        assertEquals(1L, count("settlements", f.groupId()), "one key, one settlement");

        // the requests that lost the race simply retry with the same key and get the existing settlement back
        String winnerId = settlements.findByGroupIdAndStatus(f.groupId(), SettlementStatus.PENDING).get(0).getId();
        for (Outcome failed : outcomes.stream().filter(o -> !o.ok()).toList()) {
            SettlementResult retry = settlementCommands.create(f.ahmed(), f.groupId(), key, request);
            assertFalse(retry.created());
            assertEquals(winnerId, retry.response().id());
        }
        assertEquals(1L, count("settlements", f.groupId()));
        assertEquals(List.of(winnerId), outcomes.stream().filter(Outcome::ok)
                .map(o -> ((SettlementResult) o.value()).response().id()).distinct().collect(Collectors.toList()),
                "every request that succeeded must have been given the same settlement");
    }

    @Test
    void twoReceiversConfirmingTheSameSettlement_isImpossible() throws Exception {
        Fixture f = newGroup();
        ownerPaysForEveryone(f, 30000);
        String id = settlementCommands.create(f.ahmed(), f.groupId(), null,
                new CreateSettlementRequest(f.owner(), 5000L, "x")).response().id();

        // the same receiver confirms from several requests at once (a double click, a retried request)
        List<Callable<?>> tasks = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            tasks.add(() -> settlementCommands.confirm(f.owner(), f.groupId(), id));
        }
        List<Outcome> outcomes = runTogether(tasks);

        outcomes.stream().filter(o -> !o.ok())
                .forEach(o -> assertAcceptable(o.error(), ErrorCode.SETTLEMENT_NOT_PENDING));
        assertEquals(1L, outcomes.stream().filter(Outcome::ok).count(), "exactly one confirmation can win");

        var balances = balanceService.getBalances(f.owner(), f.groupId());
        long ahmedReceived = balances.members().stream().filter(m -> m.userId().equals(f.owner()))
                .findFirst().orElseThrow().receivedMinor();
        assertEquals(5000L, ahmedReceived, "the money must be counted once, not once per request");
        assertEquals(0L, balances.sumMinor());
    }
}
