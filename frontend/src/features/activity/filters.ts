import { validDate } from '@/features/expenses/filters'
import { ACTIVITY_ACTIONS, type ActivityAction } from '@/types/api'

export const ACTIVITY_PAGE_SIZE = 20

/** What the history of a group is filtered by. Like the expenses, it lives in the address bar. */
export interface ActivityFilters {
  action: ActivityAction | ''
  actorId: string
  /** yyyy-MM-dd or '' */
  from: string
  to: string
  /** zero-based */
  page: number
}

export const NO_ACTIVITY_FILTERS: ActivityFilters = { action: '', actorId: '', from: '', to: '', page: 0 }

export function parseActivityFilters(params: URLSearchParams): ActivityFilters {
  const action = params.get('action') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const page = Number(params.get('page') ?? '0')
  return {
    action: (ACTIVITY_ACTIONS as readonly string[]).includes(action) ? (action as ActivityAction) : '',
    actorId: params.get('actorId') ?? '',
    from: validDate(from) ? from : '',
    to: validDate(to) ? to : '',
    page: Number.isInteger(page) && page > 0 ? page : 0,
  }
}

export function serializeActivityFilters(filters: ActivityFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.action) params.set('action', filters.action)
  if (filters.actorId) params.set('actorId', filters.actorId)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.page > 0) params.set('page', String(filters.page))
  return params
}

export function toActivityQuery(filters: ActivityFilters): Record<string, string | number> {
  const query: Record<string, string | number> = { page: filters.page, size: ACTIVITY_PAGE_SIZE }
  if (filters.action) query.action = filters.action
  if (filters.actorId) query.actorId = filters.actorId
  if (filters.from) query.from = filters.from
  if (filters.to) query.to = filters.to
  return query
}

export function hasActivityFilters(filters: ActivityFilters): boolean {
  return Boolean(filters.action || filters.actorId || filters.from || filters.to)
}

export function activityPeriodIsReversed(filters: ActivityFilters): boolean {
  return Boolean(filters.from && filters.to && filters.from > filters.to)
}

/** Where to read about what a history line is about, or null when nothing is there to open (a deleted expense). */
export function activityHref(groupId: string, line: { entityType: string; entityId: string; action: string }): string | null {
  const base = `/groups/${encodeURIComponent(groupId)}`
  if (line.entityType === 'EXPENSE' && line.action !== 'EXPENSE_DELETED') return `${base}/expenses/${encodeURIComponent(line.entityId)}`
  if (line.entityType === 'SETTLEMENT') return `${base}/settlements`
  if (line.entityType === 'MEMBERSHIP') return `${base}/members`
  if (line.entityType === 'GROUP') return `${base}/settings`
  return null
}
