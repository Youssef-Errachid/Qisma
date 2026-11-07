package com.qisma.dto.response;

import java.util.List;

/** sumMinor is the sum of every net balance. It is always 0 for a consistent ledger. */
public record BalancesResponse(String currency, long sumMinor, List<MemberBalanceResponse> members) {
}
