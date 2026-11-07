import { api } from '@/lib/api/client'
import type { CreateGroupRequest, GroupResponse } from '@/types/api'

export async function listGroups(): Promise<GroupResponse[]> {
  const { data } = await api.get<GroupResponse[]>('/groups')
  return data
}

export async function getGroup(groupId: string): Promise<GroupResponse> {
  const { data } = await api.get<GroupResponse>(`/groups/${encodeURIComponent(groupId)}`)
  return data
}

export async function createGroup(request: CreateGroupRequest): Promise<GroupResponse> {
  const { data } = await api.post<GroupResponse>('/groups', request)
  return data
}
