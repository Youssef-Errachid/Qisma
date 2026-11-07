package com.qisma.service;

import com.qisma.dto.response.BalancesResponse;
import com.qisma.dto.response.MemberBalanceResponse;

public interface BalanceService {

    BalancesResponse getBalances(String userId, String groupId);

    MemberBalanceResponse getBalance(String userId, String groupId, String targetUserId);
}
