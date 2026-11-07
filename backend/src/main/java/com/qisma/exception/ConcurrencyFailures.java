package com.qisma.exception;

import com.mongodb.MongoException;

/**
 * Recognises a MongoDB transaction that lost a race with another one (write conflict). It looks through the
 * whole cause chain, so it does not depend on which Spring exception happens to wrap the driver's error.
 */
public final class ConcurrencyFailures {

    static final int WRITE_CONFLICT_CODE = 112;
    static final String TRANSIENT_LABEL = "TransientTransactionError";
    private static final int MAX_DEPTH = 10;

    private ConcurrencyFailures() {
    }

    public static boolean isTransientConflict(Throwable error) {
        Throwable current = error;
        for (int depth = 0; current != null && depth < MAX_DEPTH; depth++) {
            if (current instanceof MongoException mongo
                    && (mongo.getCode() == WRITE_CONFLICT_CODE || mongo.hasErrorLabel(TRANSIENT_LABEL))) {
                return true;
            }
            if (current.getCause() == current) {
                return false;
            }
            current = current.getCause();
        }
        return false;
    }
}
