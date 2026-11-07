import { api } from '@/lib/api/client'
import type { ActivityLine, PageResponse } from '@/types/api'

/** The history of one thing (an expense, a settlement), newest first. */
export async function listActivityOf(groupId: string, entityId: string): Promise<PageResponse<ActivityLine>> {
  const { data } = await api.get<PageResponse<ActivityLine>>(`/groups/${encodeURIComponent(groupId)}/activity`, {
    params: { entityId, size: 50 },
  })
  return data
}
