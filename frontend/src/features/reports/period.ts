/** The periods the dashboard offers. The server counts whole UTC days and months, so everything here is UTC too. */
export const PERIODS = ['thisMonth', 'last3', 'last12', 'all'] as const
export type PeriodId = (typeof PERIODS)[number]
export const DEFAULT_PERIOD: PeriodId = 'last12'

export interface PeriodRange {
  /** yyyy-MM-dd; undefined means "from the beginning" */
  from?: string
  /** yyyy-MM-dd; undefined means "until today and beyond" */
  to?: string
  /** yyyy-MM, both always present: the monthly chart needs a window */
  monthlyFrom: string
  monthlyTo: string
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Month arithmetic that carries over years in both directions: (2026, -2) is November 2025. */
function monthOf(year: number, monthIndex: number): { year: number; month: number } {
  const date = new Date(Date.UTC(year, monthIndex, 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
}

function yearMonth(year: number, monthIndex: number): string {
  const { year: y, month } = monthOf(year, monthIndex)
  return `${y}-${pad(month)}`
}

function firstDay(year: number, monthIndex: number): string {
  return `${yearMonth(year, monthIndex)}-01`
}

function lastDay(year: number, monthIndex: number): string {
  const day = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  return `${yearMonth(year, monthIndex)}-${pad(day)}`
}

/** How many months the monthly chart shows for a period (the server allows at most 60). */
const MONTHLY_WINDOW: Record<PeriodId, number> = { thisMonth: 12, last3: 3, last12: 12, all: 60 }

export function periodRange(period: PeriodId, today: Date): PeriodRange {
  const year = today.getUTCFullYear()
  const month = today.getUTCMonth()
  const window = MONTHLY_WINDOW[period]
  const monthly = { monthlyFrom: yearMonth(year, month - (window - 1)), monthlyTo: yearMonth(year, month) }

  switch (period) {
    case 'thisMonth':
      return { from: firstDay(year, month), to: lastDay(year, month), ...monthly }
    case 'last3':
      return { from: firstDay(year, month - 2), to: lastDay(year, month), ...monthly }
    case 'last12':
      return { from: firstDay(year, month - 11), to: lastDay(year, month), ...monthly }
    case 'all':
      return monthly
  }
}
