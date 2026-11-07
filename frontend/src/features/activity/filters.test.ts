import { describe, expect, it } from 'vitest'
import { ACTIVITY_PAGE_SIZE, NO_ACTIVITY_FILTERS, activityHref, activityPeriodIsReversed, hasActivityFilters, parseActivityFilters, serializeActivityFilters, toActivityQuery } from './filters'

const parse = (query: string) => parseActivityFilters(new URLSearchParams(query))

describe('activity filters', () => {
  it('reads every filter from the address', () => {
    expect(parse('action=EXPENSE_UPDATED&actorId=u1&from=2026-10-01&to=2026-10-31&page=2')).toEqual({
      action: 'EXPENSE_UPDATED', actorId: 'u1', from: '2026-10-01', to: '2026-10-31', page: 2,
    })
  })

  it('shows everything for an empty or mangled address instead of failing', () => {
    expect(parse('')).toEqual(NO_ACTIVITY_FILTERS)
    expect(parse('action=NOPE&from=2026-02-30&to=yesterday&page=-1')).toEqual(NO_ACTIVITY_FILTERS)
  })

  it('writes only what differs from "no filter", and round-trips', () => {
    expect(serializeActivityFilters(NO_ACTIVITY_FILTERS).toString()).toBe('')
    const filters = { action: 'SETTLEMENT_CONFIRMED' as const, actorId: 'u2', from: '2026-01-01', to: '2026-12-31', page: 3 }
    expect(parseActivityFilters(serializeActivityFilters(filters))).toEqual(filters)
  })

  it('asks the server for a page and a size, and for nothing that is empty', () => {
    expect(toActivityQuery(NO_ACTIVITY_FILTERS)).toEqual({ page: 0, size: ACTIVITY_PAGE_SIZE })
    expect(toActivityQuery({ action: 'GROUP_UPDATED', actorId: 'u1', from: '2026-01-01', to: '', page: 1 })).toEqual({
      page: 1, size: ACTIVITY_PAGE_SIZE, action: 'GROUP_UPDATED', actorId: 'u1', from: '2026-01-01',
    })
  })

  it('does not count the page as a filter, and spots an impossible period', () => {
    expect(hasActivityFilters({ ...NO_ACTIVITY_FILTERS, page: 4 })).toBe(false)
    expect(hasActivityFilters({ ...NO_ACTIVITY_FILTERS, actorId: 'u1' })).toBe(true)
    expect(activityPeriodIsReversed({ ...NO_ACTIVITY_FILTERS, from: '2026-11-01', to: '2026-10-01' })).toBe(true)
    expect(activityPeriodIsReversed({ ...NO_ACTIVITY_FILTERS, from: '2026-10-01', to: '2026-10-01' })).toBe(false)
  })
})

describe('activityHref: where a history line leads', () => {
  it('leads to an expense, but not to one that was deleted (there is nothing to open)', () => {
    expect(activityHref('g1', { entityType: 'EXPENSE', entityId: 'e9', action: 'EXPENSE_UPDATED' })).toBe('/groups/g1/expenses/e9')
    expect(activityHref('g1', { entityType: 'EXPENSE', entityId: 'e9', action: 'EXPENSE_DELETED' })).toBeNull()
  })

  it('leads to the repayments, the members and the settings for what concerns them', () => {
    expect(activityHref('g1', { entityType: 'SETTLEMENT', entityId: 's1', action: 'SETTLEMENT_CONFIRMED' })).toBe('/groups/g1/settlements')
    expect(activityHref('g1', { entityType: 'MEMBERSHIP', entityId: 'u1', action: 'MEMBER_LEFT' })).toBe('/groups/g1/members')
    expect(activityHref('g1', { entityType: 'GROUP', entityId: 'g1', action: 'GROUP_UPDATED' })).toBe('/groups/g1/settings')
  })

  it('encodes what it puts in the address', () => {
    expect(activityHref('g 1', { entityType: 'EXPENSE', entityId: 'a/b', action: 'EXPENSE_CREATED' })).toBe('/groups/g%201/expenses/a%2Fb')
  })
})
