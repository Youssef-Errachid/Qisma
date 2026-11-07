import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ActivityList } from '@/components/shared/ActivityList'
import { Money } from '@/components/shared/Money'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LoadingState, QueryErrorState } from '@/components/ui/StateViews'
import { useActivityOf } from '@/features/activity/queries'
import { useAuth } from '@/features/auth/useAuth'
import { canModifyExpense } from '@/features/expenses/permissions'
import { useDeleteExpense, useExpense } from '@/features/expenses/queries'
import { useGroupContext } from '@/features/groups/useGroupContext'
import { memberNames, useMembers } from '@/features/members/queries'
import { ApiError } from '@/lib/api/errors'
import { errorMessage } from '@/lib/api/errorMessage'
import { formatDate, formatDateTime } from '@/lib/format'

export function ExpenseDetailPage() {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? 'en'
  const { expenseId = '' } = useParams<{ expenseId: string }>()
  const group = useGroupContext()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const listPath = `/groups/${encodeURIComponent(group.id)}/expenses${(location.state as { listSearch?: string } | null)?.listSearch ?? ''}`

  const expense = useExpense(group.id, expenseId)
  const members = useMembers(group.id)
  const history = useActivityOf(group.id, expenseId)
  const remove = useDeleteExpense(group.id)
  const [confirming, setConfirming] = useState(false)
  const nameOf = memberNames(members.data)

  if (expense.isPending) {
    return <LoadingState />
  }
  if (expense.isError) {
    if (expense.error instanceof ApiError && expense.error.status === 404) {
      return (
        <section className="space-y-4 pt-6 text-center">
          <h2 className="text-xl font-semibold">{t('expenses.detail.notFoundTitle')}</h2>
          <p className="text-slate-600">{t('expenses.detail.notFoundBody')}</p>
          <Link to={listPath} className="font-medium text-brand hover:underline">
            {t('expenses.detail.back')}
          </Link>
        </section>
      )
    }
    return <QueryErrorState error={expense.error} onRetry={() => void expense.refetch()} />
  }

  const e = expense.data
  const allowed = canModifyExpense(e, user?.id, group)

  const rows: Array<[string, React.ReactNode]> = [
    [t('expenses.detail.date'), formatDate(`${e.expenseDate}T00:00:00Z`, language)],
    [t('expenses.detail.category'), t(`categories.${e.category}`)],
    [t('expenses.detail.amount'), <Money key="amount" minor={e.amountMinor} currency={e.currency} />],
    [t('expenses.detail.paidBy'), nameOf(e.paidBy)],
    [t('expenses.detail.split'), t(`expenses.split.${e.splitMethod}`)],
    [t('expenses.detail.createdBy'), `${nameOf(e.createdBy)} · ${formatDateTime(e.createdAt, language)}`],
  ]
  if (e.updatedAt !== e.createdAt) {
    rows.push([t('expenses.detail.updatedOn'), formatDateTime(e.updatedAt, language)])
  }

  return (
    <section className="space-y-6 pt-6">
      <Link to={listPath} className="text-sm font-medium text-slate-500 hover:text-slate-700">
        ← {t('expenses.detail.back')}
      </Link>

      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">{e.title}</h2>
        {e.description && <p className="text-slate-700">{e.description}</p>}
      </div>

      <dl className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-slate-500">{label}</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-3">
        <h3 className="text-base font-semibold">{t('expenses.detail.shares')}</h3>
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-start text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2.5 text-start font-medium">{t('expenses.detail.member')}</th>
                <th scope="col" className="px-4 py-2.5 text-end font-medium">{t('expenses.detail.share')}</th>
                {e.splitMethod === 'PERCENTAGE' && (
                  <th scope="col" className="px-4 py-2.5 text-end font-medium">{t('expenses.detail.percentage')}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {e.shares.map((share) => (
                <tr key={share.userId}>
                  <td className="px-4 py-2.5">
                    {nameOf(share.userId)}
                    {share.userId === e.paidBy && <span className="ms-2"><Badge tone="brand">{t('expenses.detail.payer')}</Badge></span>}
                  </td>
                  <td className="px-4 py-2.5 text-end"><Money minor={share.shareMinor} currency={e.currency} /></td>
                  {e.splitMethod === 'PERCENTAGE' && (
                    <td className="px-4 py-2.5 text-end tabular-nums">{((share.percentageBp ?? 0) / 100).toFixed(2)}%</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {group.status === 'ARCHIVED' && <Alert variant="success">{t('expenses.detail.archivedNote')}</Alert>}

      {allowed && (
        <div className="space-y-3">
          {remove.isError && <Alert variant="error">{errorMessage(t, remove.error)}</Alert>}
          {!confirming ? (
            <Button variant="secondary" onClick={() => setConfirming(true)}>
              {t('expenses.detail.delete')}
            </Button>
          ) : (
            <div role="group" aria-labelledby="delete-title" className="space-y-3 rounded-2xl bg-debt-soft p-5 ring-1 ring-inset ring-rose-200">
              <p id="delete-title" className="font-semibold text-debt">{t('expenses.detail.deleteTitle')}</p>
              <p className="text-sm text-slate-700">{t('expenses.detail.deleteBody')}</p>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => { setConfirming(false); remove.reset() }}>
                  {t('common.cancel')}
                </Button>
                <Button
                  variant="danger"
                  loading={remove.isPending}
                  onClick={() =>
                    remove.mutate(e.id, {
                      onSuccess: () => navigate(`/groups/${encodeURIComponent(group.id)}/expenses`, { replace: true, state: { deleted: true } }),
                    })
                  }
                >
                  {t('expenses.detail.confirmDelete')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-base font-semibold">{t('expenses.detail.history')}</h3>
        {history.isPending && <LoadingState />}
        {history.isError && <QueryErrorState error={history.error} onRetry={() => void history.refetch()} />}
        {history.isSuccess && history.data.items.length === 0 && <p className="text-sm text-slate-500">{t('expenses.detail.noHistory')}</p>}
        {history.isSuccess && history.data.items.length > 0 && <ActivityList lines={history.data.items} currency={e.currency} />}
      </div>
    </section>
  )
}
