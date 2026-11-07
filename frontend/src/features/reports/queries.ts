import { useQuery } from '@tanstack/react-query'
import { getCategories, getContributions, getMonthly, getSummary } from './reportService'
import type { PeriodRange } from './period'

/** Anything that changes money in a group invalidates reportKeys.group(groupId), and every report refreshes. */
export const reportKeys = {
  group: (groupId: string) => ['reports', groupId] as const,
  summary: (groupId: string) => [...reportKeys.group(groupId), 'summary'] as const,
  monthly: (groupId: string, from: string, to: string) => [...reportKeys.group(groupId), 'monthly', from, to] as const,
  categories: (groupId: string, from?: string, to?: string) => [...reportKeys.group(groupId), 'categories', from ?? null, to ?? null] as const,
  contributions: (groupId: string, from?: string, to?: string) => [...reportKeys.group(groupId), 'contributions', from ?? null, to ?? null] as const,
}

export function useSummary(groupId: string) {
  return useQuery({ queryKey: reportKeys.summary(groupId), queryFn: () => getSummary(groupId) })
}

export function useMonthly(groupId: string, range: PeriodRange) {
  return useQuery({
    queryKey: reportKeys.monthly(groupId, range.monthlyFrom, range.monthlyTo),
    queryFn: () => getMonthly(groupId, range.monthlyFrom, range.monthlyTo),
  })
}

export function useCategories(groupId: string, range: PeriodRange) {
  return useQuery({
    queryKey: reportKeys.categories(groupId, range.from, range.to),
    queryFn: () => getCategories(groupId, { from: range.from, to: range.to }),
  })
}

export function useContributions(groupId: string, range: PeriodRange) {
  return useQuery({
    queryKey: reportKeys.contributions(groupId, range.from, range.to),
    queryFn: () => getContributions(groupId, { from: range.from, to: range.to }),
  })
}
