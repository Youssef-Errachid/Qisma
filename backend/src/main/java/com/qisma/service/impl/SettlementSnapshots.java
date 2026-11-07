package com.qisma.service.impl;

import com.qisma.model.Settlement;

import java.util.LinkedHashMap;
import java.util.Map;

/** A detached copy of a settlement for the history. */
final class SettlementSnapshots {

    private SettlementSnapshots() {
    }

    static Map<String, Object> of(Settlement s) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("fromUserId", s.getFromUserId());
        snapshot.put("toUserId", s.getToUserId());
        snapshot.put("amountMinor", s.getAmountMinor());
        snapshot.put("currency", s.getCurrency());
        snapshot.put("note", s.getNote());
        snapshot.put("status", s.getStatus() == null ? null : s.getStatus().name());
        snapshot.put("rejectionReason", s.getRejectionReason());
        return snapshot;
    }
}
