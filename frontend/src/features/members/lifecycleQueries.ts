import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useInvalidateMoney } from '@/features/expenses/queries'
import { groupKeys } from '@/features/groups/queries'
import { deactivateMember, leaveGroup, transferOwnership } from './lifecycleService'
import { memberKeys } from './queries'

/** Membership changes the member list, the role shown on the group, and the "left the group" mark on balances. */
function useRefreshMembership(groupId: string) {
  const queryClient = useQueryClient()
  const invalidateMoney = useInvalidateMoney(groupId)
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: memberKeys.group(groupId) }),
      queryClient.invalidateQueries({ queryKey: groupKeys.all }),
      invalidateMoney(),
    ])
}

export function useLeaveGroup(groupId: string) {
  const refresh = useRefreshMembership(groupId)
  return useMutation({ mutationFn: () => leaveGroup(groupId), onSuccess: () => refresh() })
}

export function useDeactivateMember(groupId: string) {
  const refresh = useRefreshMembership(groupId)
  return useMutation({ mutationFn: (userId: string) => deactivateMember(groupId, userId), onSuccess: () => refresh() })
}

export function useTransferOwnership(groupId: string) {
  const queryClient = useQueryClient()
  const refresh = useRefreshMembership(groupId)
  return useMutation({
    mutationFn: (newOwnerId: string) => transferOwnership(groupId, newOwnerId),
    onSuccess: (group) => {
      queryClient.setQueryData(groupKeys.detail(groupId), group)
      return refresh()
    },
  })
}
