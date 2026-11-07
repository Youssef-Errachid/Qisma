package com.qisma.service;

import com.qisma.dto.request.ActivitySearchCriteria;
import com.qisma.dto.response.ActivityResponse;
import com.qisma.dto.response.PageResponse;

public interface ActivityQueryService {

    /** Any member of the group, including one who left, sees the history. Newest first. */
    PageResponse<ActivityResponse> list(String userId, String groupId, ActivitySearchCriteria criteria,
                                        int page, int size);
}
