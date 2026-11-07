package com.qisma.service;

import com.qisma.model.Membership;
import com.qisma.service.finance.MemberBalance;

import java.util.List;
import java.util.Map;

/**
 * The financial state of a group at one moment.
 * balances: confirmed position (expenses + CONFIRMED settlements). pendingOut / pendingIn: money that members
 * have declared but the receiver has not confirmed yet.
 */
public record GroupLedger(
        List<Membership> members,
        Map<String, MemberBalance> balances,
        Map<String, Long> pendingOut,
        Map<String, Long> pendingIn
) {

    public long pendingOutOf(String userId) {
        return pendingOut.getOrDefault(userId, 0L);
    }

    public long pendingInOf(String userId) {
        return pendingIn.getOrDefault(userId, 0L);
    }

    /** What the member would be at after every pending settlement gets confirmed: net + pendingOut - pendingIn. */
    public long effectiveNetOf(String userId) {
        long net = balances.get(userId).netMinor();
        return Math.subtractExact(Math.addExact(net, pendingOutOf(userId)), pendingInOf(userId));
    }
}
