import { describe, expect, it } from 'vitest'
import { PERCENTAGE_GOLDEN } from '@/lib/split.golden'
import { type Drafts, allSelected, draftsFromExpense, fillEqually, planSplit, toParticipantInputs } from './formModel'

const IDS = ['u-youssef', 'u-ahmed', 'u-hamza']
const typed = (values: Record<string, string>): Drafts =>
  Object.fromEntries(IDS.map((id) => [id, { selected: id in values, value: values[id] ?? '' }]))
const plan = (method: 'EQUAL' | 'CUSTOM' | 'PERCENTAGE', amountMinor: number | null, drafts: Drafts) =>
  planSplit({ method, amountMinor, memberIds: IDS, drafts, digits: 2 })
const amounts = (p: ReturnType<typeof plan>) => p.shares.map((s) => s.shareMinor)

describe('planSplit: equal', () => {
  it('splits between whoever is selected, the first ones getting the leftover centime', () => {
    expect(amounts(plan('EQUAL', 10000, allSelected(IDS)))).toEqual([3334, 3333, 3333])
  })

  it('follows the order of the members, not the order in which they were ticked', () => {
    expect(plan('EQUAL', 10000, typed({ 'u-hamza': '', 'u-youssef': '' })).shares.map((s) => s.userId)).toEqual(['u-youssef', 'u-hamza'])
  })

  it('needs an amount and at least one participant', () => {
    expect(plan('EQUAL', null, allSelected(IDS)).issues).toEqual([{ kind: 'AMOUNT_REQUIRED' }])
    expect(plan('EQUAL', 10000, typed({})).issues).toEqual([{ kind: 'NO_PARTICIPANTS' }])
  })

  it('ignores what is typed in the boxes, which an equal split does not use', () => {
    expect(amounts(plan('EQUAL', 30000, typed({ 'u-youssef': 'junk', 'u-ahmed': '5', 'u-hamza': '' })))).toEqual([10000, 10000, 10000])
  })
})

describe('planSplit: custom amounts', () => {
  it('accepts amounts that add up to the total (150.00 + 100.00 + 50.00 = 300.00)', () => {
    const p = plan('CUSTOM', 30000, typed({ 'u-youssef': '150', 'u-ahmed': '100,00', 'u-hamza': '50.00' }))

    expect(p.issues).toEqual([])
    expect(amounts(p)).toEqual([15000, 10000, 5000])
    expect(p.remaining).toBe(0)
  })

  it('says how much is still to allocate, and when too much was', () => {
    expect(plan('CUSTOM', 30000, typed({ 'u-youssef': '100', 'u-ahmed': '100', 'u-hamza': '50' })).issues).toEqual([{ kind: 'CUSTOM_MISMATCH', remainingMinor: 5000 }])
    expect(plan('CUSTOM', 30000, typed({ 'u-youssef': '200', 'u-ahmed': '100', 'u-hamza': '50' })).issues).toEqual([{ kind: 'CUSTOM_MISMATCH', remainingMinor: -5000 }])
  })

  it('is off by a single centime, and says so', () => {
    expect(plan('CUSTOM', 30000, typed({ 'u-youssef': '150.00', 'u-ahmed': '100.00', 'u-hamza': '49.99' })).remaining).toBe(1)
  })

  it('allows a participant who owes nothing (0.00), which the server allows too', () => {
    const p = plan('CUSTOM', 10000, typed({ 'u-youssef': '100', 'u-ahmed': '0' }))

    expect(p.issues).toEqual([])
    expect(amounts(p)).toEqual([10000, 0])
  })

  it('flags an empty box or an unreadable amount on the right member', () => {
    expect(plan('CUSTOM', 10000, typed({ 'u-youssef': '50', 'u-ahmed': '' })).issues).toContainEqual({ kind: 'VALUE_MISSING', userId: 'u-ahmed' })
    expect(plan('CUSTOM', 10000, typed({ 'u-youssef': '50', 'u-ahmed': '5o' })).issues).toContainEqual({ kind: 'VALUE_INVALID', userId: 'u-ahmed' })
    expect(plan('CUSTOM', 10000, typed({ 'u-youssef': '50', 'u-ahmed': '-5' })).issues).toContainEqual({ kind: 'VALUE_INVALID', userId: 'u-ahmed' })
    expect(plan('CUSTOM', 10000, typed({ 'u-youssef': '50', 'u-ahmed': '1.234' })).issues).toContainEqual({ kind: 'VALUE_INVALID', userId: 'u-ahmed' })
  })

  it('keeps counting what is allocated while some boxes are still empty', () => {
    expect(plan('CUSTOM', 30000, typed({ 'u-youssef': '100', 'u-ahmed': '' })).remaining).toBe(20000)
  })

  it('has no shares to show while there is an issue', () => {
    expect(plan('CUSTOM', 30000, typed({ 'u-youssef': '100' })).shares).toEqual([])
  })
})

describe('planSplit: percentages', () => {
  it('splits 400.00 as 50% / 30% / 20% into 200.00 / 120.00 / 80.00', () => {
    const p = plan('PERCENTAGE', 40000, typed({ 'u-youssef': '50', 'u-ahmed': '30', 'u-hamza': '20' }))

    expect(p.issues).toEqual([])
    expect(amounts(p)).toEqual([20000, 12000, 8000])
    expect(p.shares.map((s) => s.percentageBp)).toEqual([5000, 3000, 2000])
  })

  it('reads percentages the way people write them', () => {
    expect(plan('PERCENTAGE', 10001, typed({ 'u-youssef': '33.33', 'u-ahmed': '33,33 %', 'u-hamza': '33.34%' })).shares.map((s) => s.percentageBp)).toEqual([3333, 3333, 3334])
  })

  it('says how many percent are missing or in excess', () => {
    expect(plan('PERCENTAGE', 10000, typed({ 'u-youssef': '50', 'u-ahmed': '30' })).issues).toEqual([{ kind: 'PERCENT_MISMATCH', remainingBp: 2000 }])
    expect(plan('PERCENTAGE', 10000, typed({ 'u-youssef': '60', 'u-ahmed': '60' })).remaining).toBe(-2000)
  })

  it('refuses more than 100%, more than two decimals, and text', () => {
    for (const bad of ['101', '100.5', '12.345', 'abc', '-5']) {
      expect(plan('PERCENTAGE', 10000, typed({ 'u-youssef': bad, 'u-ahmed': '10' })).issues, bad).toContainEqual({ kind: 'VALUE_INVALID', userId: 'u-youssef' })
    }
  })

  it('agrees with the server on the golden percentage cases, typed the way a person types them', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `u${i}`)
    for (const { total, bps, shares } of PERCENTAGE_GOLDEN.filter((g) => g.bps.length <= 20)) {
      const drafts: Drafts = Object.fromEntries(ids.map((id, i) => [id, { selected: i < bps.length, value: i < bps.length ? `${Math.floor(bps[i] / 100)}.${String(bps[i] % 100).padStart(2, '0')}` : '' }]))
      const p = planSplit({ method: 'PERCENTAGE', amountMinor: total, memberIds: ids, drafts, digits: 2 })
      expect(p.issues, `total ${total}`).toEqual([])
      expect(p.shares.map((s) => s.shareMinor), `total ${total}, bp ${bps.join('/')}`).toEqual(shares)
    }
  })
})

describe('toParticipantInputs: only the field of the method is sent (the server refuses the others)', () => {
  const shares = [
    { userId: 'a', shareMinor: 3334, percentageBp: null },
    { userId: 'b', shareMinor: 3333, percentageBp: null },
  ]

  it('sends nothing but the user for an equal split', () => {
    expect(toParticipantInputs('EQUAL', shares)).toEqual([{ userId: 'a' }, { userId: 'b' }])
  })

  it('sends the amount for a custom split', () => {
    expect(toParticipantInputs('CUSTOM', shares)).toEqual([{ userId: 'a', shareMinor: 3334 }, { userId: 'b', shareMinor: 3333 }])
  })

  it('sends the percentage, not the computed amount, for a percentage split', () => {
    expect(toParticipantInputs('PERCENTAGE', [{ userId: 'a', shareMinor: 5000, percentageBp: 5000 }])).toEqual([{ userId: 'a', percentageBp: 5000 }])
  })
})

describe('fillEqually', () => {
  it('types the equal amounts into the boxes of the selected members', () => {
    const next = fillEqually('CUSTOM', 10000, IDS, allSelected(IDS), 2)

    expect(IDS.map((id) => next[id].value)).toEqual(['33.34', '33.33', '33.33'])
    expect(plan('CUSTOM', 10000, next).issues).toEqual([])
  })

  it('types equal percentages that add up to exactly 100%', () => {
    const next = fillEqually('PERCENTAGE', 10000, IDS, allSelected(IDS), 2)

    expect(IDS.map((id) => next[id].value)).toEqual(['33.34', '33.33', '33.33'])
    expect(plan('PERCENTAGE', 10000, next).issues).toEqual([])
  })

  it('leaves the members who do not take part alone, and does nothing for an equal split or without an amount', () => {
    const next = fillEqually('CUSTOM', 10000, IDS, typed({ 'u-youssef': '', 'u-ahmed': '' }), 2)
    expect(next['u-hamza']).toEqual({ selected: false, value: '' })
    expect(fillEqually('EQUAL', 10000, IDS, allSelected(IDS), 2)).toEqual(allSelected(IDS))
    expect(fillEqually('CUSTOM', null, IDS, allSelected(IDS), 2)).toEqual(allSelected(IDS))
  })
})

describe('draftsFromExpense', () => {
  it('reproduces a custom split, in the text a person would type', () => {
    const { drafts, leftOut } = draftsFromExpense({
      splitMethod: 'CUSTOM',
      shares: [{ userId: 'u-youssef', shareMinor: 15000, percentageBp: null }, { userId: 'u-ahmed', shareMinor: 15000, percentageBp: null }],
    }, IDS, 2)

    expect(drafts['u-youssef']).toEqual({ selected: true, value: '150.00' })
    expect(drafts['u-hamza']).toEqual({ selected: false, value: '' })
    expect(leftOut).toEqual([])
  })

  it('reproduces a percentage split', () => {
    const { drafts } = draftsFromExpense({
      splitMethod: 'PERCENTAGE',
      shares: [{ userId: 'u-youssef', shareMinor: 5000, percentageBp: 3333 }, { userId: 'u-ahmed', shareMinor: 5000, percentageBp: 6667 }],
    }, IDS, 2)

    expect(drafts['u-youssef'].value).toBe('33.33')
    expect(drafts['u-ahmed'].value).toBe('66.67')
  })

  it('leaves out a participant who has left the group, and says who, so the form can warn', () => {
    const { drafts, leftOut } = draftsFromExpense({
      splitMethod: 'EQUAL',
      shares: [{ userId: 'u-youssef', shareMinor: 50, percentageBp: null }, { userId: 'u-gone', shareMinor: 50, percentageBp: null }],
    }, IDS, 2)

    expect(Object.keys(drafts)).not.toContain('u-gone')
    expect(leftOut).toEqual(['u-gone'])
  })

  it('what is read from an expense plans to the very same shares (editing without touching anything changes nothing)', () => {
    const original = { splitMethod: 'PERCENTAGE' as const, shares: [
      { userId: 'u-youssef', shareMinor: 3333, percentageBp: 3333 }, { userId: 'u-ahmed', shareMinor: 3333, percentageBp: 3333 }, { userId: 'u-hamza', shareMinor: 3335, percentageBp: 3334 },
    ] }
    const { drafts } = draftsFromExpense(original, IDS, 2)

    expect(amounts(plan('PERCENTAGE', 10001, drafts))).toEqual([3333, 3333, 3335])
  })
})
