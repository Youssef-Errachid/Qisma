import { describe, expect, it } from 'vitest'
import { categoryChartData, compactAmount, contributionChartData, monthLabel, monthlyChartData, toMajor } from './chartData'

describe('chart data', () => {
  it('turns minor units into plain numbers for the picture only', () => {
    expect(toMajor(123450, 'MAD')).toBe(1234.5)
    expect(toMajor(5, 'MAD')).toBe(0.05)
    expect(toMajor(0, 'MAD')).toBe(0)
  })

  it('labels months in the language of the user, from a yyyy-MM text', () => {
    expect(monthLabel('2026-11', 'en')).toBe('Nov 26')
    expect(monthLabel('2026-11', 'fr')).toBe('nov. 26')
    expect(monthLabel('2026-01', 'en')).toBe('Jan 26')
  })

  it('keeps the exact minor units next to the plotted value, so tooltips never show a rounded float', () => {
    const [point] = monthlyChartData([{ month: '2026-11', totalMinor: 123457, count: 3 }], 'MAD', 'en')

    expect(point).toMatchObject({ month: '2026-11', minor: 123457, count: 3 })
    expect(point.value).toBeCloseTo(1234.57, 10)
  })

  it('keeps empty months so the chart is a continuous line of bars', () => {
    const data = monthlyChartData([
      { month: '2026-09', totalMinor: 0, count: 0 }, { month: '2026-10', totalMinor: 500, count: 1 },
    ], 'MAD', 'en')

    expect(data.map((d) => d.value)).toEqual([0, 5])
  })

  it('translates the categories and shows their share with one decimal', () => {
    const data = categoryChartData([
      { category: 'FOOD', totalMinor: 7500, count: 3, shareBp: 7500 },
      { category: 'RENT', totalMinor: 2500, count: 1, shareBp: 2500 },
    ], 'MAD', (c) => `label:${c}`)

    expect(data.map((d) => d.label)).toEqual(['label:FOOD', 'label:RENT'])
    expect(data.map((d) => d.percent)).toEqual(['75.0%', '25.0%'])
    expect(data[0].value).toBe(75)
  })

  it('shows 33.3% for a third, which is what the server sends as 3333 basis points', () => {
    expect(categoryChartData([{ category: 'FOOD', totalMinor: 1, count: 1, shareBp: 3333 }], 'MAD', String)[0].percent).toBe('33.3%')
  })

  it('names the members by their full name, falling back to the username', () => {
    const data = contributionChartData([
      { userId: 'a', username: 'youssef', fullName: 'Youssef E.', paidMinor: 6000, shareMinor: 4833 },
      { userId: 'b', username: 'ghost', fullName: '', paidMinor: 0, shareMinor: 0 },
    ], 'MAD')

    expect(data.map((d) => d.name)).toEqual(['Youssef E.', 'ghost'])
    expect(data[0]).toMatchObject({ paid: 60, share: 48.33, paidMinor: 6000, shareMinor: 4833 })
  })

  it('shortens big axis values', () => {
    expect(compactAmount(1500, 'en')).toMatch(/^1\.5[kK]$/)   // the unit's case depends on the locale data
    expect(compactAmount(950, 'en')).toBe('950')
    expect(compactAmount(0, 'en')).toBe('0')
  })
})
