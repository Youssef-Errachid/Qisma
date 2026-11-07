import { useQuery } from '@tanstack/react-query'
import { getBalances } from './balanceService'
import { balanceKeys } from './keys'

export function useBalances(groupId: string) {
  return useQuery({ queryKey: balanceKeys.group(groupId), queryFn: () => getBalances(groupId) })
}
