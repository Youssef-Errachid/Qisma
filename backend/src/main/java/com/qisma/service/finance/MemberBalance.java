package com.qisma.service.finance;

/**
 * Financial position of one member.
 * net > 0: should receive money, net < 0: owes money, net == 0: balanced.
 */
public record MemberBalance(String userId, long paidMinor, long shareMinor, long sentMinor, long receivedMinor) {

    public long netMinor() {
        long net = Math.subtractExact(paidMinor, shareMinor);
        net = Math.addExact(net, sentMinor);
        return Math.subtractExact(net, receivedMinor);
    }
}
