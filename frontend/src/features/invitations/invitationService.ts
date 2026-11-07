import { api } from '@/lib/api/client'
import type { GroupResponse, InvitationPreview } from '@/types/api'

export async function previewInvitation(secret: string): Promise<InvitationPreview> {
  const { data } = await api.get<InvitationPreview>(`/invitations/${encodeURIComponent(secret)}`)
  return data
}

export async function acceptInvitation(secret: string): Promise<GroupResponse> {
  const { data } = await api.post<GroupResponse>(`/invitations/${encodeURIComponent(secret)}/accept`)
  return data
}
