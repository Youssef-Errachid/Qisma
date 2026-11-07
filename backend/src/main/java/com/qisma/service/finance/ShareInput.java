package com.qisma.service.finance;

/**
 * One participant as supplied by the caller.
 * EQUAL uses only userId, CUSTOM also needs shareMinor, PERCENTAGE needs percentageBp.
 */
public record ShareInput(String userId, Long shareMinor, Integer percentageBp) {

    public ShareInput {
        if (userId == null || userId.isBlank()) {
            throw new InvalidSplitException("userId must not be blank");
        }
    }

    public static ShareInput equal(String userId) {
        return new ShareInput(userId, null, null);
    }

    public static ShareInput custom(String userId, long shareMinor) {
        return new ShareInput(userId, shareMinor, null);
    }

    public static ShareInput percentage(String userId, int percentageBp) {
        return new ShareInput(userId, null, percentageBp);
    }
}
