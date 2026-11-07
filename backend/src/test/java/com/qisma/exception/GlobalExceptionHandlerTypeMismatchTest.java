package com.qisma.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class GlobalExceptionHandlerTypeMismatchTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void invalidParameterValue_is400_andTheValueIsNotEchoed() {
        MethodArgumentTypeMismatchException ex = mock(MethodArgumentTypeMismatchException.class);
        when(ex.getName()).thenReturn("status");
        when(ex.getValue()).thenReturn("<script>alert(1)</script>");

        ResponseEntity<ProblemDetail> r = handler.handleTypeMismatch(ex);

        assertEquals(HttpStatus.BAD_REQUEST, r.getStatusCode());
        assertEquals("VALIDATION_FAILED", r.getBody().getProperties().get("code"));
        assertTrue(r.getBody().getDetail().contains("status"));
        assertFalse(r.getBody().getDetail().contains("script"));
    }
}
