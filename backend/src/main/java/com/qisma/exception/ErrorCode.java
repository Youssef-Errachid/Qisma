package com.qisma.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
    VALIDATION_FAILED(HttpStatus.BAD_REQUEST),
    CURRENT_PASSWORD_INCORRECT(HttpStatus.BAD_REQUEST),
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED),
    INVALID_REFRESH_TOKEN(HttpStatus.UNAUTHORIZED),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED),
    FORBIDDEN(HttpStatus.FORBIDDEN),
    NOT_FOUND(HttpStatus.NOT_FOUND),
    INVITATION_INVALID(HttpStatus.NOT_FOUND),
    ACCOUNT_LOCKED(HttpStatus.LOCKED),
    EMAIL_ALREADY_USED(HttpStatus.CONFLICT),
    USERNAME_ALREADY_USED(HttpStatus.CONFLICT),
    GROUP_ARCHIVED(HttpStatus.CONFLICT),
    ALREADY_MEMBER(HttpStatus.CONFLICT),
    INVITATION_NOT_PENDING(HttpStatus.CONFLICT),
    LIMIT_REACHED(HttpStatus.valueOf(422)),
    TOO_MANY_ATTEMPTS(HttpStatus.TOO_MANY_REQUESTS),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR);

    private final HttpStatus status;

    ErrorCode(HttpStatus status) {
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
