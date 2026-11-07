import { api } from '@/lib/api/client'
import type { GroupResponse } from '@/types/api'

const group = (groupId: string) => `/groups/${encodeURIComponent(groupId)}`

/** The caller leaves. Needs a zero balance and no repayment waiting; the owner must transfer the ownership first. */
export async function leaveGroup(groupId: string): Promise<void> {
  await api.post(`${group(groupId)}/leave`)
}

/** Owner only. The member stays able to settle what they owe, but takes part in nothing new. */
export async function deactivateMember(groupId: string, userId: string): Promise<void> {
  await api.delete(`${group(groupId)}/members/${encodeURIComponent(userId)}`)
}

/** Owner only. Returns the group as the former owner now sees it (a plain member). */
export async function transferOwnership(groupId: string, newOwnerId: string): Promise<GroupResponse> {
  const { data } = await api.post<GroupResponse>(`${group(groupId)}/transfer-ownership`, { newOwnerId })
  return data
}
