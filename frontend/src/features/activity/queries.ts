import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { type ActivityFilters, toActivityQuery } from './filters'
import { listActivity, listActivityOf } from './activityService'

export const activityKeys = {
  /** everything about the history of a group: one call refreshes the lists and the histories of its things */
  group: (groupId: string) => ['activity', groupId] as const,
  list: (groupId: string, filters: ActivityFilters) => ['activity', groupId, 'list', toActivityQuery(filters)] as const,
  of: (groupId: string, entityId: string) => ['activity', groupId, entityId] as const,
}

export function useActivityOf(groupId: string, entityId: string) {
  return useQuery({ queryKey: activityKeys.of(groupId, entityId), queryFn: () => listActivityOf(groupId, entityId) })
}

export function useActivity(groupId: string, filters: ActivityFilters, enabled = true) {
  return useQuery({
    queryKey: activityKeys.list(groupId, filters),
    queryFn: () => listActivity(groupId, toActivityQuery(filters)),
    enabled,
    placeholderData: keepPreviousData,
  })
}

/** The amount before and after a change, when the history line carries both and they differ. */
export function amountChange(oldValue: Record<string, unknown> | null, newValue: Record<string, unknown> | null): [number, number] | null {
  const before = oldValue?.amountMinor
  const after = newValue?.amountMinor
  if (typeof before === 'number' && typeof after === 'number' && before !== after) {
    return [before, after]
  }
  return null
}
