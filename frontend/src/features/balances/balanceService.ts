import { api } from '@/lib/api/client'
import type { BalancesResponse } from '@/types/api'

export async function getBalances(groupId: string): Promise<BalancesResponse> {
  const { data } = await api.get<BalancesResponse>(`/groups/${encodeURIComponent(groupId)}/balances`)
  return data
}
