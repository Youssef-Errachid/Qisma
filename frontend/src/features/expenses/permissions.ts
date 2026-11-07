import type { ExpenseResponse, GroupResponse } from '@/types/api'

/**
 * Who may change an expense: the member who created it, and the owner of the group (who moderates). Nobody can
 * change anything in an archived group. The server decides for real; this only keeps buttons that would fail out of sight.
 */
export function canModifyExpense(expense: Pick<ExpenseResponse, 'createdBy'>, userId: string | undefined, group: Pick<GroupResponse, 'myRole' | 'status'>): boolean {
  if (!userId || group.status !== 'ACTIVE') {
    return false
  }
  return expense.createdBy === userId || group.myRole === 'OWNER'
}
