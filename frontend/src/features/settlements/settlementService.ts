import { api } from '@/lib/api/client'
import type { CreateSettlementRequest, PageResponse, SettlementResponse, SuggestionsResponse } from '@/types/api'

const base = (groupId: string) => `/groups/${encodeURIComponent(groupId)}/settlements`

export async function listSettlements(groupId: string, query: Record<string, string | number>): Promise<PageResponse<SettlementResponse>> {
  const { data } = await api.get<PageResponse<SettlementResponse>>(base(groupId), { params: query })
  return data
}

/** A hint computed on what is still owed, counting repayments already waiting. Nothing is stored. */
export async function getSuggestions(groupId: string): Promise<SuggestionsResponse> {
  const { data } = await api.get<SuggestionsResponse>(`${base(groupId)}/suggestions`)
  return data
}

/**
 * Declares a repayment (it only counts once the receiver confirms it). The Idempotency-Key makes a repeated request
 * (a double click, a retry after a dropped connection) return the same settlement instead of declaring the money twice.
 */
export async function createSettlement(groupId: string, request: CreateSettlementRequest, idempotencyKey: string): Promise<SettlementResponse> {
  const { data } = await api.post<SettlementResponse>(base(groupId), request, { headers: { 'Idempotency-Key': idempotencyKey } })
  return data
}

export async function confirmSettlement(groupId: string, settlementId: string): Promise<SettlementResponse> {
  const { data } = await api.post<SettlementResponse>(`${base(groupId)}/${encodeURIComponent(settlementId)}/confirm`)
  return data
}

export async function rejectSettlement(groupId: string, settlementId: string, reason: string | undefined): Promise<SettlementResponse> {
  const { data } = await api.post<SettlementResponse>(`${base(groupId)}/${encodeURIComponent(settlementId)}/reject`, reason ? { reason } : {})
  return data
}

export async function cancelSettlement(groupId: string, settlementId: string): Promise<SettlementResponse> {
  const { data } = await api.post<SettlementResponse>(`${base(groupId)}/${encodeURIComponent(settlementId)}/cancel`)
  return data
}
