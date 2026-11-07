import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LoadingState, QueryErrorState } from '@/components/ui/StateViews'
import { useAuth } from '@/features/auth/useAuth'
import { ExpenseForm } from '@/features/expenses/ExpenseForm'
import { canModifyExpense } from '@/features/expenses/permissions'
import { useExpense } from '@/features/expenses/queries'
import { useGroupContext } from '@/features/groups/useGroupContext'
import { useMembers } from '@/features/members/queries'
import type { MemberResponse } from '@/types/api'
import { ApiError } from '@/lib/api/errors'

function Shell({ title, back, children }: { title: string; back: string; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <section className="mx-auto max-w-3xl space-y-6 pt-6">
      <div>
        <Link to={back} className="text-sm font-medium text-slate-500 hover:text-slate-700">← {t('expenses.detail.back')}</Link>
        <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Notice({ text, back }: { text: string; back: string }) {
  const { t } = useTranslation()
  return (
    <section className="space-y-4 pt-6 text-center">
      <p className="text-slate-700">{text}</p>
      <Link to={back} className="font-medium text-brand hover:underline">{t('expenses.detail.back')}</Link>
    </section>
  )
}

/** /expenses/new and /expenses/:id/edit */
export function ExpenseFormPage() {
  const { t } = useTranslation()
  const { expenseId } = useParams<{ expenseId: string }>()
  const group = useGroupContext()
  const { user } = useAuth()
  const members = useMembers(group.id)
  const listPath = `/groups/${encodeURIComponent(group.id)}/expenses`

  if (members.isPending) return <LoadingState />
  if (members.isError) return <QueryErrorState error={members.error} onRetry={() => void members.refetch()} />

  // only active members can be the payer or take part: the server refuses anyone else
  const active = members.data.filter((m) => m.status === 'ACTIVE')
  const me = active.find((m) => m.userId === user?.id)
  if (group.status !== 'ACTIVE') return <Notice text={t('expenseForm.blocked.archived')} back={listPath} />
  if (!me || !user) return <Notice text={t('expenseForm.blocked.notActive')} back={listPath} />

  if (!expenseId) {
    return (
      <Shell title={t('expenseForm.createTitle')} back={listPath}>
        <ExpenseForm group={group} members={active} everyone={members.data} userId={user.id} />
      </Shell>
    )
  }
  return <EditExpense expenseId={expenseId} active={active} everyone={members.data} userId={user.id} />
}

function EditExpense({ expenseId, active, everyone, userId }: { expenseId: string; active: MemberResponse[]; everyone: MemberResponse[]; userId: string }) {
  const { t } = useTranslation()
  const group = useGroupContext()
  const expense = useExpense(group.id, expenseId)
  const listPath = `/groups/${encodeURIComponent(group.id)}/expenses`

  if (expense.isPending) return <LoadingState />
  if (expense.isError) {
    if (expense.error instanceof ApiError && expense.error.status === 404) {
      return <Notice text={t('expenses.detail.notFoundBody')} back={listPath} />
    }
    return <QueryErrorState error={expense.error} onRetry={() => void expense.refetch()} />
  }
  if (!canModifyExpense(expense.data, userId, group)) {
    return <Notice text={t('expenseForm.blocked.notAllowed')} back={`${listPath}/${encodeURIComponent(expenseId)}`} />
  }
  return (
    <Shell title={t('expenseForm.editTitle')} back={`${listPath}/${encodeURIComponent(expenseId)}`}>
      {/* a new version of the expense (after "load the latest version") starts the form again from it */}
      <ExpenseForm key={expense.data.version} group={group} members={active} everyone={everyone} userId={userId} expense={expense.data} />
    </Shell>
  )
}
