import type { BalancesResponse, MemberBalance, SettlementResponse } from '@/types/api'

/**
 * The most that can be declared from one member to another right now: what the sender still owes and what the
 * receiver is still owed, both counting repayments already waiting (effective balances). The server checks the same
 * rule when the repayment is created, so this only stops the obvious mistake before it is sent.
 */
export function settlementCap(balances: BalancesResponse, fromUserId: string, toUserId: string): number {
  const from = balances.members.find((m) => m.userId === fromUserId)
  const to = balances.members.find((m) => m.userId === toUserId)
  if (!from || !to) {
    return 0
  }
  return Math.min(Math.max(0, -from.effectiveNetMinor), Math.max(0, to.effectiveNetMinor))
}

/** What a member can do with a repayment: the receiver decides, the sender may withdraw it, and only while it waits. */
export type SettlementAction = 'confirm' | 'reject' | 'cancel'

export function actionsFor(settlement: Pick<SettlementResponse, 'status' | 'fromUserId' | 'toUserId'>, userId: string | undefined, groupActive: boolean): SettlementAction[] {
  if (!userId || !groupActive || settlement.status !== 'PENDING') {
    return []
  }
  if (settlement.toUserId === userId) {
    return ['confirm', 'reject']
  }
  if (settlement.fromUserId === userId) {
    return ['cancel']
  }
  return []
}

export type Position = { kind: 'receive' | 'owe' | 'settled'; amountMinor: number }

/** "You should receive 253.33", "You owe 100.00" or "settled": from the confirmed balance of the member. */
export function positionOf(balance: Pick<MemberBalance, 'netMinor'>): Position {
  if (balance.netMinor > 0) return { kind: 'receive', amountMinor: balance.netMinor }
  if (balance.netMinor < 0) return { kind: 'owe', amountMinor: -balance.netMinor }
  return { kind: 'settled', amountMinor: 0 }
}

/** Those who are owed first (the biggest first), then those who owe (the biggest debt first), then those settled up. */
export function sortBalances(members: readonly MemberBalance[]): MemberBalance[] {
  const rank = (m: MemberBalance) => (m.netMinor > 0 ? 0 : m.netMinor < 0 ? 1 : 2)
  return [...members].sort((a, b) => rank(a) - rank(b) || Math.abs(b.netMinor) - Math.abs(a.netMinor) || a.fullName.localeCompare(b.fullName))
}

/** A random id for one open form. Made once, when the form opens. */
export function newFormId(): string {
  return crypto.randomUUID().replaceAll('-', '')
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * The Idempotency-Key of a repayment: the form it comes from plus what it says. Sending the same repayment again (a
 * second click, a retry after a dropped connection) reuses the key, so the server returns the first one instead of
 * declaring the money twice. Changing the amount or the person makes a different request, so it needs a new key, or the
 * server would refuse it as a reuse of the old one. 8 to 64 characters of letters, digits, - and _, as the server requires.
 */
export function requestKey(formId: string, request: { toUserId: string; amountMinor: number; note?: string }): string {
  return `${formId}-${fnv1a(`${request.toUserId}|${request.amountMinor}|${request.note ?? ''}`)}`
}
