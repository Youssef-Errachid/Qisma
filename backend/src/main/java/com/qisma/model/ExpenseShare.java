package com.qisma.model;

/** The share of one participant, computed by the server and stored as a fixed snapshot. */
public record ExpenseShare(String userId, long shareMinor, Integer percentageBp) {
}
