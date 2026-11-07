import { fractionDigits, formatMoney } from '@/lib/money'
import { localeFor } from '@/lib/format'
import type { CategoryItem, MemberContribution, MonthlyPoint } from '@/types/api'

/** Display only: charts need plain numbers. Every real amount stays an integer in minor units. */
export function toMajor(minor: number, currency: string): number {
  return minor / 10 ** fractionDigits(currency)
}

export interface MonthDatum {
  month: string
  label: string
  value: number
  minor: number
  count: number
}

/** "2026-11" as "Nov 26" in the user's language. */
export function monthLabel(month: string, language: string): string {
  const [year, number] = month.split('-').map(Number)
  return new Intl.DateTimeFormat(localeFor(language), { month: 'short', year: '2-digit', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, number - 1, 1)))
}

export function monthlyChartData(points: readonly MonthlyPoint[], currency: string, language: string): MonthDatum[] {
  return points.map((p) => ({
    month: p.month,
    label: monthLabel(p.month, language),
    value: toMajor(p.totalMinor, currency),
    minor: p.totalMinor,
    count: p.count,
  }))
}

export interface CategoryDatum {
  category: string
  label: string
  value: number
  minor: number
  count: number
  percent: string
}

export function categoryChartData(
  items: readonly CategoryItem[], currency: string, labelOf: (category: string) => string,
): CategoryDatum[] {
  return items.map((c) => ({
    category: c.category,
    label: labelOf(c.category),
    value: toMajor(c.totalMinor, currency),
    minor: c.totalMinor,
    count: c.count,
    percent: `${(c.shareBp / 100).toFixed(1)}%`,
  }))
}

export interface ContributionDatum {
  userId: string
  name: string
  paid: number
  share: number
  paidMinor: number
  shareMinor: number
}

export function contributionChartData(members: readonly MemberContribution[], currency: string): ContributionDatum[] {
  return members.map((m) => ({
    userId: m.userId,
    name: m.fullName || m.username,
    paid: toMajor(m.paidMinor, currency),
    share: toMajor(m.shareMinor, currency),
    paidMinor: m.paidMinor,
    shareMinor: m.shareMinor,
  }))
}

/** 12 500.00 as "12.5K" on a chart axis. */
export function compactAmount(value: number, language: string): string {
  return new Intl.NumberFormat(localeFor(language), { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function tooltipAmount(minor: number, currency: string, language: string): string {
  return formatMoney(minor, currency, localeFor(language))
}
