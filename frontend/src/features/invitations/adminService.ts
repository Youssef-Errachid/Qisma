import { api } from '@/lib/api/client'
import type { CreateInvitationRequest, InvitationCreated, InvitationSummary } from '@/types/api'

const base = (groupId: string) => `/groups/${encodeURIComponent(groupId)}/invitations`

export async function listInvitations(groupId: string): Promise<InvitationSummary[]> {
  const { data } = await api.get<InvitationSummary[]>(base(groupId))
  return data
}

export async function createInvitation(groupId: string, request: CreateInvitationRequest): Promise<InvitationCreated> {
  const { data } = await api.post<InvitationCreated>(base(groupId), request)
  return data
}

export async function revokeInvitation(groupId: string, invitationId: string): Promise<void> {
  await api.delete(`${base(groupId)}/${encodeURIComponent(invitationId)}`)
}
