import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateGroupRequest, GroupResponse } from '@/types/api'
import { createGroup, getGroup, listGroups } from './groupService'

/** One place for every cache key, so a change in one screen refreshes the others. */
export const groupKeys = {
  all: ['groups'] as const,
  list: () => [...groupKeys.all, 'list'] as const,
  detail: (groupId: string) => [...groupKeys.all, 'detail', groupId] as const,
}

export function useGroups() {
  return useQuery({ queryKey: groupKeys.list(), queryFn: listGroups })
}

export function useGroup(groupId: string) {
  return useQuery({ queryKey: groupKeys.detail(groupId), queryFn: () => getGroup(groupId) })
}

export function useCreateGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: CreateGroupRequest) => createGroup(request),
    onSuccess: (group) => {
      // the new screen can show it at once, and the list refetches the next time it is opened
      queryClient.setQueryData(groupKeys.detail(group.id), group)
      void queryClient.invalidateQueries({ queryKey: groupKeys.list() })
    },
  })
}

/** Active groups first, then the most recently created. Pure, so it is easy to test. */
export function sortGroups(groups: readonly GroupResponse[]): GroupResponse[] {
  return [...groups].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'ACTIVE' ? -1 : 1
    }
    return Date.parse(b.createdAt) - Date.parse(a.createdAt)
  })
}
