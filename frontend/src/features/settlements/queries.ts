import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { useInvalidateMoney } from '@/features/expenses/queries'
import { ApiError } from '@/lib/api/errors'
import type { CreateSettlementRequest, SettlementStatus } from '@/types/api'
import { settlementKeys } from './keys'
import { cancelSettlement, confirmSettlement, createSettlement, getSuggestions, listSettlements, rejectSettlement } from './settlementService'

export const SETTLEMENT_PAGE_SIZE = 20

export interface SettlementFilters {
  status: SettlementStatus | ''
  /** zero-based */
  page: number
}

function toQuery(filters: SettlementFilters): Record<string, string | number> {
  return { page: filters.page, size: SETTLEMENT_PAGE_SIZE, ...(filters.status ? { status: filters.status } : {}) }
}

export function useSettlements(groupId: string, filters: SettlementFilters) {
  const query = toQuery(filters)
  return useQuery({
    queryKey: settlementKeys.list(groupId, query),
    queryFn: () => listSettlements(groupId, query),
    placeholderData: keepPreviousData,
  })
}

/** Everything waiting for a decision, whoever it concerns. A group has few at a time, so one page of 100 is the whole list. */
export function usePendingSettlements(groupId: string) {
  const query = { status: 'PENDING', page: 0, size: 100 }
  return useQuery({ queryKey: settlementKeys.list(groupId, query), queryFn: () => listSettlements(groupId, query) })
}

export function useSuggestions(groupId: string) {
  return useQuery({ queryKey: settlementKeys.suggestions(groupId), queryFn: () => getSuggestions(groupId) })
}

/** The key is made once per form and sent with every attempt: sending it again returns the first settlement. */
export function useCreateSettlement(groupId: string, idempotencyKey: string) {
  const invalidate = useInvalidateMoney(groupId)
  return useMutation({
    mutationFn: (request: CreateSettlementRequest) => createSettlement(groupId, request, idempotencyKey),
    onSuccess: () => invalidate(),
  })
}

/** When the repayment was already handled (by the other person, or from another tab), what is shown is stale: reload it. */
function refreshIfAlreadyHandled(invalidate: () => Promise<unknown>) {
  return (error: unknown) => {
    if (error instanceof ApiError && error.code === 'SETTLEMENT_NOT_PENDING') {
      void invalidate()
    }
  }
}

export function useConfirmSettlement(groupId: string) {
  const invalidate = useInvalidateMoney(groupId)
  return useMutation({ mutationFn: (id: string) => confirmSettlement(groupId, id), onSuccess: () => invalidate(), onError: refreshIfAlreadyHandled(invalidate) })
}

export function useRejectSettlement(groupId: string) {
  const invalidate = useInvalidateMoney(groupId)
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => rejectSettlement(groupId, id, reason),
    onSuccess: () => invalidate(),
    onError: refreshIfAlreadyHandled(invalidate),
  })
}

export function useCancelSettlement(groupId: string) {
  const invalidate = useInvalidateMoney(groupId)
  return useMutation({ mutationFn: (id: string) => cancelSettlement(groupId, id), onSuccess: () => invalidate(), onError: refreshIfAlreadyHandled(invalidate) })
}
