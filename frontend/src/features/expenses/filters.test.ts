import { describe, expect, it } from 'vitest'
import { NO_FILTERS, PAGE_SIZE, hasActiveFilters, parseFilters, periodIsReversed, serializeFilters, toApiQuery } from './filters'

const parse = (query: string) => parseFilters(new URLSearchParams(query))

describe('parseFilters', () => {
  it('reads every filter from the address', () => {
    expect(parse('q=gro&category=FOOD&paidBy=u1&participant=u2&from=2026-10-01&to=2026-10-31&page=3')).toEqual({
      q: 'gro', category: 'FOOD', paidBy: 'u1', participant: 'u2', from: '2026-10-01', to: '2026-10-31', page: 3,
    })
  })

  it('shows the unfiltered list for an empty address', () => {
    expect(parse('')).toEqual(NO_FILTERS)
  })

  it('ignores what is not valid instead of failing: a mangled link must still open the list', () => {
    expect(parse('category=NOPE&from=yesterday&to=2026-02-30&page=-4')).toEqual(NO_FILTERS)
    expect(parse('page=abc')).toEqual(NO_FILTERS)
    expect(parse('page=1.5')).toEqual(NO_FILTERS)
    expect(parse('from=2026-13-01')).toEqual(NO_FILTERS)
  })

  it('accepts real calendar dates, leap days included', () => {
    expect(parse('from=2028-02-29').from).toBe('2028-02-29')
    expect(parse('from=2026-02-29').from).toBe('')
  })

  it('limits the search text', () => {
    expect(parse(`q=${'x'.repeat(300)}`).q).toHaveLength(100)
  })
})

describe('serializeFilters', () => {
  it('writes only what differs from "no filter", so the plain list has a plain address', () => {
    expect(serializeFilters(NO_FILTERS).toString()).toBe('')
    expect(serializeFilters({ ...NO_FILTERS, category: 'RENT' }).toString()).toBe('category=RENT')
    expect(serializeFilters({ ...NO_FILTERS, page: 2 }).toString()).toBe('page=2')
  })

  it('round-trips through the address', () => {
    const filters = { q: 'taxi to the airport', category: 'TRANSPORTATION' as const, paidBy: 'u1', participant: 'u2', from: '2026-01-01', to: '2026-12-31', page: 4 }

    expect(parseFilters(serializeFilters(filters))).toEqual(filters)
  })
})

describe('toApiQuery', () => {
  it('always asks for a page and a size, and for nothing that is empty', () => {
    expect(toApiQuery(NO_FILTERS)).toEqual({ page: 0, size: PAGE_SIZE })
  })

  it('sends the filters under the names the API knows, with the search text trimmed', () => {
    expect(toApiQuery({ q: '  gro  ', category: 'FOOD', paidBy: 'u1', participant: 'u2', from: '2026-10-01', to: '2026-10-31', page: 2 })).toEqual({
      page: 2, size: PAGE_SIZE, q: 'gro', category: 'FOOD', paidBy: 'u1', participant: 'u2', from: '2026-10-01', to: '2026-10-31',
    })
  })

  it('does not send a search made of spaces', () => {
    expect(toApiQuery({ ...NO_FILTERS, q: '   ' })).toEqual({ page: 0, size: PAGE_SIZE })
  })
})

describe('hasActiveFilters and periodIsReversed', () => {
  it('does not count the page as a filter', () => {
    expect(hasActiveFilters({ ...NO_FILTERS, page: 5 })).toBe(false)
    expect(hasActiveFilters({ ...NO_FILTERS, q: 'x' })).toBe(true)
    expect(hasActiveFilters({ ...NO_FILTERS, to: '2026-01-01' })).toBe(true)
  })

  it('spots a period that ends before it starts', () => {
    expect(periodIsReversed({ ...NO_FILTERS, from: '2026-11-01', to: '2026-10-01' })).toBe(true)
    expect(periodIsReversed({ ...NO_FILTERS, from: '2026-10-01', to: '2026-10-01' })).toBe(false)
    expect(periodIsReversed({ ...NO_FILTERS, from: '2026-11-01' })).toBe(false)
  })
})
