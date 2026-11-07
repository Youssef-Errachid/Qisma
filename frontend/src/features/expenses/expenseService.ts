import { api } from '@/lib/api/client'
import type { ExpenseRequest, ExpenseResponse, PageResponse, UpdateExpenseRequest } from '@/types/api'

const base = (groupId: string) => `/groups/${encodeURIComponent(groupId)}/expenses`

export type ExpenseQuery = Record<string, string | number>

export async function listExpenses(groupId: string, query: ExpenseQuery): Promise<PageResponse<ExpenseResponse>> {
  const { data } = await api.get<PageResponse<ExpenseResponse>>(base(groupId), { params: query })
  return data
}

export async function getExpense(groupId: string, expenseId: string): Promise<ExpenseResponse> {
  const { data } = await api.get<ExpenseResponse>(`${base(groupId)}/${encodeURIComponent(expenseId)}`)
  return data
}

export async function createExpense(groupId: string, request: ExpenseRequest): Promise<ExpenseResponse> {
  const { data } = await api.post<ExpenseResponse>(base(groupId), request)
  return data
}

/** Replaces the expense. Refused with VERSION_CONFLICT when someone saved a newer version meanwhile. */
export async function updateExpense(groupId: string, expenseId: string, request: UpdateExpenseRequest): Promise<ExpenseResponse> {
  const { data } = await api.put<ExpenseResponse>(`${base(groupId)}/${encodeURIComponent(expenseId)}`, request)
  return data
}

/** A soft delete: the server keeps the expense and its history, and stops counting it. */
export async function deleteExpense(groupId: string, expenseId: string): Promise<void> {
  await api.delete(`${base(groupId)}/${encodeURIComponent(expenseId)}`)
}
