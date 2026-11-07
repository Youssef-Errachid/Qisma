package com.qisma.exception;

import com.mongodb.MongoException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.*;

class ConcurrencyFailuresTest {

    @Test
    void aWriteConflict_isRecognised_evenWhenWrappedSeveralTimes() {
        Throwable wrapped = new RuntimeException("outer", new IllegalStateException("middle",
                new MongoException(ConcurrencyFailures.WRITE_CONFLICT_CODE, "WriteConflict")));

        assertTrue(ConcurrencyFailures.isTransientConflict(wrapped));
    }

    @Test
    void aTransientTransactionLabel_isRecognised() {
        MongoException labelled = new MongoException("transaction aborted");
        labelled.addLabel(ConcurrencyFailures.TRANSIENT_LABEL);

        assertTrue(ConcurrencyFailures.isTransientConflict(new RuntimeException(labelled)));
    }

    @Test
    void otherErrors_areNotMistakenForAConflict() {
        assertFalse(ConcurrencyFailures.isTransientConflict(new RuntimeException("boom")));
        assertFalse(ConcurrencyFailures.isTransientConflict(new MongoException(11000, "duplicate key")));
        assertFalse(ConcurrencyFailures.isTransientConflict(null));
    }

    @Test
    void aSelfReferencingCause_doesNotLoopForever() {
        RuntimeException error = new RuntimeException("loop") {
            @Override
            public synchronized Throwable getCause() {
                return this;
            }
        };
        assertFalse(ConcurrencyFailures.isTransientConflict(error));
    }

    @Test
    void theHandler_turnsAConflictInto409_insteadOfA500() {
        ResponseEntity<ProblemDetail> r = new GlobalExceptionHandler().handleUnexpected(
                new RuntimeException("wrapper", new MongoException(ConcurrencyFailures.WRITE_CONFLICT_CODE, "wc")));

        assertEquals(HttpStatus.CONFLICT, r.getStatusCode());
        assertEquals("CONCURRENT_UPDATE", r.getBody().getProperties().get("code"));
    }

    @Test
    void theHandler_stillReturns500_forRealBugs() {
        ResponseEntity<ProblemDetail> r = new GlobalExceptionHandler()
                .handleUnexpected(new IllegalStateException("a real bug"));

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, r.getStatusCode());
    }
}
