package com.qisma.service;

import com.qisma.dto.response.SettlementResponse;

/** created is false when an Idempotency-Key replay returned the settlement that already existed. */
public record SettlementResult(SettlementResponse response, boolean created) {
}
