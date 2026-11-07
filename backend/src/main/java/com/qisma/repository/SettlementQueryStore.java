package com.qisma.repository;

import com.qisma.enums.SettlementStatus;
import com.qisma.model.Settlement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface SettlementQueryStore {

    /**
     * Settlements of one group, optionally filtered by status and by a member taking part on either side,
     * in the order and window given by the pageable.
     */
    Page<Settlement> search(String groupId, SettlementStatus status, String userId, Pageable pageable);
}
