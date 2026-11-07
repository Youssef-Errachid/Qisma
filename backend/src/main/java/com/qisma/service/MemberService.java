package com.qisma.service;

import com.qisma.dto.response.MemberResponse;
import com.qisma.enums.MembershipStatus;

import java.util.List;

public interface MemberService {

    /** @param status optional filter; null returns every member, active or not */
    List<MemberResponse> list(String userId, String groupId, MembershipStatus status);
}
