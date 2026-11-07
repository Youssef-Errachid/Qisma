import { useQuery } from '@tanstack/react-query'
import type { MemberResponse } from '@/types/api'
import { listMembers } from './memberService'

export const memberKeys = {
  group: (groupId: string) => ['members', groupId] as const,
}

export function useMembers(groupId: string) {
  return useQuery({ queryKey: memberKeys.group(groupId), queryFn: () => listMembers(groupId) })
}

/** Names to show for user ids. A member the list does not know (it should not happen) shows as "?" rather than an id. */
export function memberNames(members: readonly MemberResponse[] | undefined): (userId: string) => string {
  const byId = new Map((members ?? []).map((m) => [m.userId, m.fullName || m.username]))
  return (userId) => byId.get(userId) ?? '?'
}
