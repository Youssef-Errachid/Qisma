import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/types/api'
import type { ExpenseQuery } from './expenseService'

export const PAGE_SIZE = 20

/** What the list is filtered by. It lives in the address bar, so a filtered list can be shared and survives a reload. */
export interface ExpenseFilters {
  q: string
  category: ExpenseCategory | ''
  paidBy: string
  participant: string
  /** yyyy-MM-dd or '' */
  from: string
  to: string
  /** zero-based */
  page: number
}

export const NO_FILTERS: ExpenseFilters = { q: '', category: '', paidBy: '', participant: '', from: '', to: '', page: 0 }

export function validDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) {
    return false
  }
  const [, y, m, d] = match.map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** Reads the address bar. Anything that is not valid is ignored: a mangled link shows the unfiltered list, not an error. */
export function parseFilters(params: URLSearchParams): ExpenseFilters {
  const category = params.get('category') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const page = Number(params.get('page') ?? '0')
  return {
    q: (params.get('q') ?? '').slice(0, 100),
    category: (EXPENSE_CATEGORIES as readonly string[]).includes(category) ? (category as ExpenseCategory) : '',
    paidBy: params.get('paidBy') ?? '',
    participant: params.get('participant') ?? '',
    from: validDate(from) ? from : '',
    to: validDate(to) ? to : '',
    page: Number.isInteger(page) && page > 0 ? page : 0,
  }
}

/** Only what differs from "no filter" goes into the address, so the plain list has a plain address. */
export function serializeFilters(filters: ExpenseFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.category) params.set('category', filters.category)
  if (filters.paidBy) params.set('paidBy', filters.paidBy)
  if (filters.participant) params.set('participant', filters.participant)
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.page > 0) params.set('page', String(filters.page))
  return params
}

export function toApiQuery(filters: ExpenseFilters): ExpenseQuery {
  const query: ExpenseQuery = { page: filters.page, size: PAGE_SIZE }
  if (filters.q.trim()) query.q = filters.q.trim()
  if (filters.category) query.category = filters.category
  if (filters.paidBy) query.paidBy = filters.paidBy
  if (filters.participant) query.participant = filters.participant
  if (filters.from) query.from = filters.from
  if (filters.to) query.to = filters.to
  return query
}

/** Does the list show everything, or is something filtered out? (The page number is not a filter.) */
export function hasActiveFilters(filters: ExpenseFilters): boolean {
  return Boolean(filters.q || filters.category || filters.paidBy || filters.participant || filters.from || filters.to)
}

/** The period is the one filter that can be impossible: an end before its start. */
export function periodIsReversed(filters: ExpenseFilters): boolean {
  return Boolean(filters.from && filters.to && filters.from > filters.to)
}
