import { api } from '@/lib/api/client'
import type { MemberResponse } from '@/types/api'

export async function listMembers(groupId: string): Promise<MemberResponse[]> {
  const { data } = await api.get<MemberResponse[]>(`/groups/${encodeURIComponent(groupId)}/members`)
  return data
}
