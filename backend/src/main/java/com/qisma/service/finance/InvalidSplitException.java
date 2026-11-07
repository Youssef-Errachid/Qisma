package com.qisma.service.finance;

/** Thrown when a split request violates a financial rule. */
public class InvalidSplitException extends RuntimeException {
    public InvalidSplitException(String message) {
        super(message);
    }
}
