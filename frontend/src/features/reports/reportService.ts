import { api } from '@/lib/api/client'
import type { CategoryReport, ContributionsReport, MonthlyReport, ReportSummary } from '@/types/api'

const base = (groupId: string) => `/groups/${encodeURIComponent(groupId)}/reports`

export interface DateRange {
  /** yyyy-MM-dd, inclusive */
  from?: string
  /** yyyy-MM-dd, inclusive */
  to?: string
}

export async function getSummary(groupId: string): Promise<ReportSummary> {
  const { data } = await api.get<ReportSummary>(`${base(groupId)}/summary`)
  return data
}

/** from and to are yyyy-MM. */
export async function getMonthly(groupId: string, from: string, to: string): Promise<MonthlyReport> {
  const { data } = await api.get<MonthlyReport>(`${base(groupId)}/monthly`, { params: { from, to } })
  return data
}

export async function getCategories(groupId: string, range: DateRange): Promise<CategoryReport> {
  const { data } = await api.get<CategoryReport>(`${base(groupId)}/categories`, { params: range })
  return data
}

export async function getContributions(groupId: string, range: DateRange): Promise<ContributionsReport> {
  const { data } = await api.get<ContributionsReport>(`${base(groupId)}/contributions`, { params: range })
  return data
}
