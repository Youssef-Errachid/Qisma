package com.qisma.integration;

import com.qisma.dto.request.CreateExpenseRequest;
import com.qisma.dto.request.CreateGroupRequest;
import com.qisma.dto.request.ParticipantInput;
import com.qisma.dto.response.GroupResponse;
import com.qisma.enums.ExpenseCategory;
import com.qisma.enums.GroupRole;
import com.qisma.enums.SplitMethod;
import com.qisma.exception.ApiException;
import com.qisma.exception.ConcurrencyFailures;
import com.qisma.exception.ErrorCode;
import com.qisma.model.Expense;
import com.qisma.model.Membership;
import com.qisma.repository.ExpenseRepository;
import com.qisma.repository.GroupRepository;
import com.qisma.repository.MembershipRepository;
import com.qisma.repository.SettlementRepository;
import com.qisma.service.BalanceService;
import com.qisma.service.ExpenseService;
import com.qisma.service.GroupLifecycleService;
import com.qisma.service.GroupService;
import com.qisma.service.SettlementCommandService;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.fail;

/**
 * Integration tests run the REAL services against a REAL MongoDB replica set, because what they prove (transactions,
 * rollbacks, conditional updates, unique indexes, write conflicts) cannot be proven with mocks.
 *
 * They use their own database (name ending in _it) on the local replica set; override the address with the
 * QISMA_IT_MONGO_URI environment variable (for CI). The database is emptied before every test, and the support
 * class refuses to do so on any database whose name does not end in _it.
 *
 * Run them with:  ./mvnw test -Dtest='*IT'
 */
@SpringBootTest(properties = {
        "spring.mongodb.uri=${QISMA_IT_MONGO_URI:mongodb://localhost:27017/qisma_it?replicaSet=rs0}",
        "qisma.jwt.secret=integration-tests-only-secret-0123456789abcdef-0123456789",
        "qisma.refresh.cookie-secure=false"
})
abstract class IntegrationTestSupport {

    record Fixture(String groupId, String owner, String ahmed, String hamza) {
    }

    record Outcome(Object value, Throwable error) {
        boolean ok() {
            return error == null;
        }
    }

    @Autowired protected MongoTemplate mongo;
    @Autowired protected GroupService groupService;
    @Autowired protected GroupLifecycleService lifecycle;
    @Autowired protected ExpenseService expenseService;
    @Autowired protected SettlementCommandService settlementCommands;
    @Autowired protected BalanceService balanceService;
    @Autowired protected GroupRepository groups;
    @Autowired protected MembershipRepository memberships;
    @Autowired protected ExpenseRepository expenses;
    @Autowired protected SettlementRepository settlements;

    @BeforeEach
    void cleanDatabase() {
        String name = mongo.getDb().getName();
        if (!name.endsWith("_it")) {
            throw new IllegalStateException("Refusing to empty database '" + name
                    + "': integration tests must use a database whose name ends with _it");
        }
        // documents only: the indexes created at startup must survive, they are part of what is being tested
        for (String collection : mongo.getCollectionNames()) {
            mongo.remove(new Query(), collection);
        }
    }

    // ---------------- data ----------------

    protected static String newId(String prefix) {
        return prefix + "-" + UUID.randomUUID();
    }

    /** A MAD group with an owner and two ordinary members. */
    protected Fixture newGroup() {
        Fixture f = newGroupWithOwnerOnly();
        memberships.save(new Membership(f.groupId(), f.ahmed(), GroupRole.MEMBER, Instant.now()));
        memberships.save(new Membership(f.groupId(), f.hamza(), GroupRole.MEMBER, Instant.now()));
        return f;
    }

    protected Fixture newGroupWithOwnerOnly() {
        String owner = newId("owner");
        GroupResponse group = groupService.create(owner, new CreateGroupRequest("IT group", null, "MAD"));
        return new Fixture(group.id(), owner, newId("ahmed"), newId("hamza"));
    }

    protected static CreateExpenseRequest expense(String paidBy, long amountMinor, String... participants) {
        List<ParticipantInput> inputs = Arrays.stream(participants)
                .map(id -> new ParticipantInput(id, null, null)).toList();
        return new CreateExpenseRequest("IT expense", null, amountMinor, null, paidBy,
                LocalDate.of(2026, 11, 7), ExpenseCategory.FOOD, SplitMethod.EQUAL, inputs);
    }

    /** The owner pays and the three members share equally: owner is owed 2/3, the others owe 1/3 each. */
    protected void ownerPaysForEveryone(Fixture f, long amountMinor) {
        expenseService.create(f.owner(), f.groupId(), expense(f.owner(), amountMinor, f.owner(), f.ahmed(), f.hamza()));
    }

    // ---------------- reading the database directly ----------------

    protected long count(String collection, String groupId) {
        return mongo.count(Query.query(Criteria.where("groupId").is(groupId)), collection);
    }

    protected long ledgerVersion(String groupId) {
        return groups.findById(groupId).orElseThrow().getLedgerVersion();
    }

    protected List<Expense> expensesOf(String groupId) {
        return mongo.find(Query.query(Criteria.where("groupId").is(groupId)), Expense.class);
    }

    protected long activeOwners(String groupId) {
        return mongo.count(Query.query(Criteria.where("groupId").is(groupId)
                .and("role").is("OWNER").and("status").is("ACTIVE")), "memberships");
    }

    // ---------------- concurrency ----------------

    /** Starts all tasks at the same instant and returns how each one ended. */
    protected static List<Outcome> runTogether(List<Callable<?>> tasks) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(tasks.size());
        CountDownLatch ready = new CountDownLatch(tasks.size());
        CountDownLatch go = new CountDownLatch(1);
        List<Future<Outcome>> futures = new ArrayList<>();
        try {
            for (Callable<?> task : tasks) {
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    go.await();
                    try {
                        return new Outcome(task.call(), null);
                    } catch (Throwable t) {
                        return new Outcome(null, t);
                    }
                }));
            }
            ready.await();
            go.countDown();
            List<Outcome> outcomes = new ArrayList<>();
            for (Future<Outcome> future : futures) {
                outcomes.add(future.get(60, TimeUnit.SECONDS));
            }
            return outcomes;
        } finally {
            pool.shutdownNow();
        }
    }

    /**
     * A failure is acceptable when it is a business refusal the test expects or a lost race that is safe to retry.
     * Anything else (an unmapped exception, a 500) fails the test and prints the whole cause chain.
     */
    protected static void assertAcceptable(Throwable error, ErrorCode... allowed) {
        if (ConcurrencyFailures.isTransientConflict(error)) {
            return;
        }
        if (error instanceof ApiException api && Arrays.asList(allowed).contains(api.getCode())) {
            return;
        }
        fail("Unexpected failure: " + describe(error), error);
    }

    protected static boolean isLostRace(Throwable error) {
        return ConcurrencyFailures.isTransientConflict(error);
    }

    private static String describe(Throwable error) {
        StringBuilder chain = new StringBuilder();
        for (Throwable t = error; t != null; t = t.getCause()) {
            chain.append("\n   ").append(t.getClass().getName()).append(": ").append(t.getMessage());
            if (t.getCause() == t) {
                break;
            }
        }
        return chain.toString();
    }
}
