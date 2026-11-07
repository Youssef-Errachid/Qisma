import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { GroupResponse } from '@/types/api'
import { activityKeys } from '@/features/activity/queries'
import { groupKeys } from './queries'

export interface UpdateGroupRequest {
  name: string
  description?: string
  /** only sent when it changed: the server refuses to change it once the group has money in it */
  currency?: string
}

const path = (groupId: string) => `/groups/${encodeURIComponent(groupId)}`

export async function updateGroup(groupId: string, request: UpdateGroupRequest): Promise<GroupResponse> {
  const { data } = await api.put<GroupResponse>(path(groupId), request)
  return data
}

/** Makes the group read-only for everybody, for good. Refused while a repayment is waiting. */
export async function archiveGroup(groupId: string): Promise<void> {
  await api.delete(path(groupId))
}

export function useUpdateGroup(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: UpdateGroupRequest) => updateGroup(groupId, request),
    onSuccess: (group) => {
      queryClient.setQueryData(groupKeys.detail(groupId), group)
      void queryClient.invalidateQueries({ queryKey: activityKeys.group(groupId) })
      return queryClient.invalidateQueries({ queryKey: groupKeys.list() })
    },
  })
}

export function useArchiveGroup(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => archiveGroup(groupId),
    // the group is read again, and now says ARCHIVED: every screen of it follows
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: groupKeys.all }), queryClient.invalidateQueries({ queryKey: activityKeys.group(groupId) })]),
  })
}
