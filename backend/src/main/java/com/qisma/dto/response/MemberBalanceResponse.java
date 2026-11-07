package com.qisma.dto.response;

import com.qisma.enums.MembershipStatus;

/**
 * Financial position of one member, in minor units. net = paid - share + sent - received:
 * positive means the member should receive money, negative means the member owes money.
 */
public record MemberBalanceResponse(
        String userId,
        String username,
        String fullName,
        MembershipStatus membershipStatus,
        long paidMinor,
        long shareMinor,
        long sentMinor,
        long receivedMinor,
        long netMinor
) {
}
