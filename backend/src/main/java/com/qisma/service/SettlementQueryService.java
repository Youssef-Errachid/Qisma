package com.qisma.service;

import com.qisma.dto.response.PageResponse;
import com.qisma.dto.response.SettlementResponse;
import com.qisma.dto.response.SuggestionsResponse;
import com.qisma.enums.SettlementStatus;

public interface SettlementQueryService {

    PageResponse<SettlementResponse> list(String userId, String groupId, SettlementStatus status,
                                          String memberId, int page, int size);

    SuggestionsResponse suggestions(String userId, String groupId);
}
