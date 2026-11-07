package com.qisma.exception;

import org.junit.jupiter.api.Test;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.*;

class GlobalExceptionHandlerConflictTest {

    @Test
    void anOptimisticLockFailure_is409_notA500() {
        ResponseEntity<ProblemDetail> r = new GlobalExceptionHandler()
                .handleOptimisticLock(new OptimisticLockingFailureException("stale"));

        assertEquals(HttpStatus.CONFLICT, r.getStatusCode());
        assertEquals("VERSION_CONFLICT", r.getBody().getProperties().get("code"));
    }
}
