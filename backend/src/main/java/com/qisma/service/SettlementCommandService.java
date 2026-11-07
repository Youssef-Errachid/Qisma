package com.qisma.service;

import com.qisma.dto.request.CreateSettlementRequest;
import com.qisma.dto.response.SettlementResponse;

public interface SettlementCommandService {

    /** The sender is the caller. idempotencyKey is optional. */
    SettlementResult create(String userId, String groupId, String idempotencyKey, CreateSettlementRequest request);

    /** Only the receiver. */
    SettlementResponse confirm(String userId, String groupId, String settlementId);

    /** Only the receiver. */
    SettlementResponse reject(String userId, String groupId, String settlementId, String reason);

    /** Only the sender, while it is still pending. */
    SettlementResponse cancel(String userId, String groupId, String settlementId);
}
