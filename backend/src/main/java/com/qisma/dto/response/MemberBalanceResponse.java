package com.qisma.dto.response;

import com.qisma.enums.MembershipStatus;

/**
 * Financial position of one member, in minor units.
 * net = paid - share + sent - received (confirmed settlements only): positive means the member should receive
 * money, negative means the member owes money.
 * effectiveNet = net + pendingOut - pendingIn: where the member ends up once every pending settlement is confirmed.
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
        long netMinor,
        long pendingOutMinor,
        long pendingInMinor,
        long effectiveNetMinor
) {
}
