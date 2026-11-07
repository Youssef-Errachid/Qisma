import { describe, expect, it } from 'vitest'
import { periodRange } from './period'

const utc = (iso: string) => new Date(`${iso}T12:00:00Z`)

describe('periodRange', () => {
  it('this month: from the 1st to the last day, and the chart still shows a year of context', () => {
    expect(periodRange('thisMonth', utc('2026-11-07'))).toEqual({
      from: '2026-11-01', to: '2026-11-30', monthlyFrom: '2025-12', monthlyTo: '2026-11',
    })
  })

  it('last 3 months: this month and the two before it', () => {
    expect(periodRange('last3', utc('2026-11-07'))).toEqual({
      from: '2026-09-01', to: '2026-11-30', monthlyFrom: '2026-09', monthlyTo: '2026-11',
    })
  })

  it('last 12 months: this month and the eleven before it', () => {
    expect(periodRange('last12', utc('2026-11-07'))).toEqual({
      from: '2025-12-01', to: '2026-11-30', monthlyFrom: '2025-12', monthlyTo: '2026-11',
    })
  })

  it('all time: no limits for the totals, and the longest window the server allows for the chart', () => {
    const range = periodRange('all', utc('2026-11-07'))

    expect(range.from).toBeUndefined()
    expect(range.to).toBeUndefined()
    expect(range.monthlyFrom).toBe('2021-12')
    expect(range.monthlyTo).toBe('2026-11')
  })

  it('crosses the year boundary in both directions', () => {
    expect(periodRange('last3', utc('2026-01-15'))).toMatchObject({ from: '2025-11-01', to: '2026-01-31', monthlyFrom: '2025-11' })
    expect(periodRange('last12', utc('2026-12-31'))).toMatchObject({ from: '2026-01-01', to: '2026-12-31', monthlyFrom: '2026-01' })
  })

  it('knows the length of February, leap years included', () => {
    expect(periodRange('thisMonth', utc('2026-02-10')).to).toBe('2026-02-28')
    expect(periodRange('thisMonth', utc('2028-02-10')).to).toBe('2028-02-29')
    expect(periodRange('thisMonth', utc('2026-04-30')).to).toBe('2026-04-30')
  })

  it('works in UTC like the server: just after midnight UTC is already the new month', () => {
    expect(periodRange('thisMonth', new Date('2026-12-01T00:30:00Z')).from).toBe('2026-12-01')
    expect(periodRange('thisMonth', new Date('2026-11-30T23:30:00Z')).from).toBe('2026-11-01')
  })

  it('never asks the server for more than 60 months', () => {
    const { monthlyFrom, monthlyTo } = periodRange('all', utc('2026-11-07'))
    const [fy, fm] = monthlyFrom.split('-').map(Number)
    const [ty, tm] = monthlyTo.split('-').map(Number)
    expect((ty - fy) * 12 + (tm - fm) + 1).toBeLessThanOrEqual(60)
  })
})
