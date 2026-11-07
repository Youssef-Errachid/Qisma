import { api } from '@/lib/api/client'
import type { ActivityLine, PageResponse } from '@/types/api'

/** The history of the whole group, newest first, narrowed by the filters. */
export async function listActivity(groupId: string, query: Record<string, string | number>): Promise<PageResponse<ActivityLine>> {
  const { data } = await api.get<PageResponse<ActivityLine>>(`/groups/${encodeURIComponent(groupId)}/activity`, { params: query })
  return data
}

/** The history of one thing (an expense, a settlement), newest first. */
export async function listActivityOf(groupId: string, entityId: string): Promise<PageResponse<ActivityLine>> {
  const { data } = await api.get<PageResponse<ActivityLine>>(`/groups/${encodeURIComponent(groupId)}/activity`, {
    params: { entityId, size: 50 },
  })
  return data
}
