import { describe, expect, it } from 'vitest'
import { BALANCES, balance } from '@/test/fixtures'
import type { BalancesResponse } from '@/types/api'
import { actionsFor, newFormId, positionOf, requestKey, settlementCap, sortBalances } from './rules'

const book = (...members: ReturnType<typeof balance>[]): BalancesResponse => ({ currency: 'MAD', sumMinor: 0, members })

describe('settlementCap', () => {
  it('is the smaller of what the sender owes and what the receiver is owed', () => {
    // Ahmed owes 150.00; Youssef is owed 100.00 and Hamza 50.00
    expect(settlementCap(BALANCES, 'u-ahmed', 'u-youssef')).toBe(10000)
    expect(settlementCap(BALANCES, 'u-ahmed', 'u-hamza')).toBe(5000)
  })

  it('is zero when the sender owes nothing, or the receiver is owed nothing', () => {
    expect(settlementCap(BALANCES, 'u-youssef', 'u-hamza')).toBe(0)
    expect(settlementCap(BALANCES, 'u-ahmed', 'u-ahmed')).toBe(0)
    expect(settlementCap(book(balance({ userId: 'a', netMinor: -100 }), balance({ userId: 'b', netMinor: -100 })), 'a', 'b')).toBe(0)
  })

  it('counts the repayments already waiting: they use up what is still owed', () => {
    const waiting = book(
      balance({ userId: 'a', netMinor: -15000, effectiveNetMinor: -9000 }),
      balance({ userId: 'b', netMinor: 15000, effectiveNetMinor: 9000 }),
    )

    expect(settlementCap(waiting, 'a', 'b')).toBe(9000)
  })

  it('is zero for someone who is not in the group', () => {
    expect(settlementCap(BALANCES, 'u-ahmed', 'ghost')).toBe(0)
    expect(settlementCap(BALANCES, 'ghost', 'u-youssef')).toBe(0)
  })
})

describe('actionsFor: who can do what with a repayment', () => {
  const pending = { status: 'PENDING', fromUserId: 'sender', toUserId: 'receiver' } as const

  it('lets the receiver decide: confirm or reject', () => {
    expect(actionsFor(pending, 'receiver', true)).toEqual(['confirm', 'reject'])
  })

  it('lets the sender only withdraw it', () => {
    expect(actionsFor(pending, 'sender', true)).toEqual(['cancel'])
  })

  it('gives nothing to anyone else, not even the owner of the group', () => {
    expect(actionsFor(pending, 'someone-else', true)).toEqual([])
    expect(actionsFor(pending, undefined, true)).toEqual([])
  })

  it('gives nothing once the repayment is decided', () => {
    for (const status of ['CONFIRMED', 'REJECTED', 'CANCELLED'] as const) {
      expect(actionsFor({ ...pending, status }, 'receiver', true), status).toEqual([])
      expect(actionsFor({ ...pending, status }, 'sender', true), status).toEqual([])
    }
  })

  it('gives nothing in an archived group', () => {
    expect(actionsFor(pending, 'receiver', false)).toEqual([])
  })
})

describe('positionOf and sortBalances', () => {
  it('says whether a member should receive, owes, or is settled', () => {
    expect(positionOf({ netMinor: 11666 })).toEqual({ kind: 'receive', amountMinor: 11666 })
    expect(positionOf({ netMinor: -25333 })).toEqual({ kind: 'owe', amountMinor: 25333 })
    expect(positionOf({ netMinor: 0 })).toEqual({ kind: 'settled', amountMinor: 0 })
  })

  it('lists those owed first (the biggest first), then those who owe (the biggest debt first), then those settled', () => {
    const sorted = sortBalances([
      balance({ userId: 'settled', fullName: 'Zed', netMinor: 0 }),
      balance({ userId: 'owes-small', fullName: 'B', netMinor: -100 }),
      balance({ userId: 'owed-small', fullName: 'C', netMinor: 100 }),
      balance({ userId: 'owes-big', fullName: 'D', netMinor: -9000 }),
      balance({ userId: 'owed-big', fullName: 'E', netMinor: 9000 }),
    ])

    expect(sorted.map((m) => m.userId)).toEqual(['owed-big', 'owed-small', 'owes-big', 'owes-small', 'settled'])
  })

  it('does not modify the list it was given', () => {
    const input = [balance({ userId: 'a', netMinor: -1 }), balance({ userId: 'b', netMinor: 1 })]
    sortBalances(input)
    expect(input.map((m) => m.userId)).toEqual(['a', 'b'])
  })
})

describe('requestKey: the Idempotency-Key of a repayment', () => {
  const request = { toUserId: 'u-ahmed', amountMinor: 5000 }

  it('has the form the server accepts (8 to 64 letters, digits, dash or underscore)', () => {
    expect(requestKey(newFormId(), request)).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
    expect(requestKey(newFormId(), { ...request, note: 'à la banque — 50 €' })).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
  })

  it('is the SAME for the same repayment from the same form, so a second click or a retry is recognised', () => {
    const form = newFormId()
    expect(requestKey(form, request)).toBe(requestKey(form, { ...request }))
  })

  it('is DIFFERENT when the amount, the person or the note changes, or the server would refuse it as a reuse', () => {
    const form = newFormId()
    const keys = new Set([
      requestKey(form, request),
      requestKey(form, { ...request, amountMinor: 5001 }),
      requestKey(form, { ...request, toUserId: 'u-hamza' }),
      requestKey(form, { ...request, note: 'cash' }),
    ])
    expect(keys.size).toBe(4)
  })

  it('is different for two forms, even with the same content', () => {
    expect(requestKey(newFormId(), request)).not.toBe(requestKey(newFormId(), request))
  })

  it('does not confuse "ab|1" with "a|b1": the parts of the content cannot slide into each other', () => {
    const form = newFormId()
    expect(requestKey(form, { toUserId: 'ab', amountMinor: 1 })).not.toBe(requestKey(form, { toUserId: 'a', amountMinor: 11 }))
  })

  it('newFormId makes a fresh 32-character id each time', () => {
    const ids = new Set(Array.from({ length: 200 }, newFormId))
    expect(ids.size).toBe(200)
    ids.forEach((id) => expect(id).toMatch(/^[0-9a-f]{32}$/))
  })
})
