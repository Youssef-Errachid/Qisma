import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateInvitationRequest } from '@/types/api'
import { createInvitation, listInvitations, revokeInvitation } from './adminService'

export const invitationKeys = {
  group: (groupId: string) => ['invitations', groupId] as const,
}

export function useInvitations(groupId: string, enabled: boolean) {
  return useQuery({ queryKey: invitationKeys.group(groupId), queryFn: () => listInvitations(groupId), enabled })
}

export function useCreateInvitation(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (request: CreateInvitationRequest) => createInvitation(groupId, request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationKeys.group(groupId) }),
  })
}

export function useRevokeInvitation(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(groupId, invitationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationKeys.group(groupId) }),
  })
}
