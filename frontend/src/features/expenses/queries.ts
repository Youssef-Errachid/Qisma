import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { balanceKeys } from '@/features/balances/keys'
import { reportKeys } from '@/features/reports/queries'
import { settlementKeys } from '@/features/settlements/keys'
import { type ExpenseFilters, toApiQuery } from './filters'
import { createExpense, deleteExpense, getExpense, listExpenses, updateExpense } from './expenseService'
import type { ExpenseRequest, UpdateExpenseRequest } from '@/types/api'

/** Everything about the expenses of a group is under expenseKeys.group(groupId): one call refreshes all of it. */
export const expenseKeys = {
  group: (groupId: string) => ['expenses', groupId] as const,
  list: (groupId: string, filters: ExpenseFilters) => [...expenseKeys.group(groupId), 'list', toApiQuery(filters)] as const,
  detail: (groupId: string, expenseId: string) => [...expenseKeys.group(groupId), 'detail', expenseId] as const,
}

export function useExpenses(groupId: string, filters: ExpenseFilters, enabled = true) {
  return useQuery({
    queryKey: expenseKeys.list(groupId, filters),
    enabled,
    queryFn: () => listExpenses(groupId, toApiQuery(filters)),
    // while the next page or a new filter loads, keep showing the previous result instead of an empty screen
    placeholderData: keepPreviousData,
  })
}

export function useExpense(groupId: string, expenseId: string) {
  return useQuery({ queryKey: expenseKeys.detail(groupId, expenseId), queryFn: () => getExpense(groupId, expenseId) })
}

/** What changes when money moves: the expenses, the reports, the balances and the suggested repayments built on them. */
export function useInvalidateMoney(groupId: string) {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: expenseKeys.group(groupId) }),
      queryClient.invalidateQueries({ queryKey: reportKeys.group(groupId) }),
      queryClient.invalidateQueries({ queryKey: balanceKeys.group(groupId) }),
      queryClient.invalidateQueries({ queryKey: settlementKeys.group(groupId) }),
    ])
}

export function useCreateExpense(groupId: string) {
  const invalidate = useInvalidateMoney(groupId)
  return useMutation({
    mutationFn: (request: ExpenseRequest) => createExpense(groupId, request),
    onSuccess: () => invalidate(),
  })
}

export function useUpdateExpense(groupId: string, expenseId: string) {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateMoney(groupId)
  return useMutation({
    mutationFn: (request: UpdateExpenseRequest) => updateExpense(groupId, expenseId, request),
    onSuccess: (saved) => {
      queryClient.setQueryData(expenseKeys.detail(groupId, expenseId), saved)
      return invalidate()
    },
  })
}

export function useDeleteExpense(groupId: string) {
  const invalidate = useInvalidateMoney(groupId)
  return useMutation({
    mutationFn: (expenseId: string) => deleteExpense(groupId, expenseId),
    onSuccess: () => invalidate(),
  })
}
