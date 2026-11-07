package com.qisma.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpRequestMethodNotSupportedException;

import static org.junit.jupiter.api.Assertions.*;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void apiException_keepsItsOwnStatusAndCode() {
        ResponseEntity<ProblemDetail> r = handler.handleApi(new ApiException(ErrorCode.NOT_FOUND, "Group not found"));
        assertEquals(HttpStatus.NOT_FOUND, r.getStatusCode());
        assertEquals("NOT_FOUND", r.getBody().getProperties().get("code"));
    }

    @Test
    void springWebExceptions_keepTheirStatus_insteadOfBecoming500() {
        ResponseEntity<ProblemDetail> r = handler.handleUnexpected(new HttpRequestMethodNotSupportedException("DELETE"));
        assertEquals(HttpStatus.METHOD_NOT_ALLOWED, r.getStatusCode());
    }

    @Test
    void trulyUnexpectedErrors_become500_withoutLeakingDetails() {
        ResponseEntity<ProblemDetail> r = handler.handleUnexpected(new IllegalStateException("db password is hunter2"));
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, r.getStatusCode());
        assertEquals("Unexpected error", r.getBody().getDetail());
    }
}
