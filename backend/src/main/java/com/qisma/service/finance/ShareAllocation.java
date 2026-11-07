package com.qisma.service.finance;

/** The computed share of one participant. percentageBp is only set for PERCENTAGE splits. */
public record ShareAllocation(String userId, long shareMinor, Integer percentageBp) {
}
