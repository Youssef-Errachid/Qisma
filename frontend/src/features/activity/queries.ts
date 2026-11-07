import { useQuery } from '@tanstack/react-query'
import { listActivityOf } from './activityService'

export const activityKeys = {
  of: (groupId: string, entityId: string) => ['activity', groupId, entityId] as const,
}

export function useActivityOf(groupId: string, entityId: string) {
  return useQuery({ queryKey: activityKeys.of(groupId, entityId), queryFn: () => listActivityOf(groupId, entityId) })
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
