import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ExpenseRow } from '@/components/shared/ExpenseRow'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { SelectField } from '@/components/ui/SelectField'
import { EmptyState, LoadingState, QueryErrorState } from '@/components/ui/StateViews'
import { TextField } from '@/components/ui/TextField'
import { useAuth } from '@/features/auth/useAuth'
import { type ExpenseFilters, hasActiveFilters, parseFilters, periodIsReversed, serializeFilters } from '@/features/expenses/filters'
import { useExpenses } from '@/features/expenses/queries'
import { useGroupContext } from '@/features/groups/useGroupContext'
import { memberNames, useMembers } from '@/features/members/queries'
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/types/api'

const SEARCH_DELAY_MS = 300

export function ExpensesPage() {
  const { t } = useTranslation()
  const group = useGroupContext()
  const { user } = useAuth()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(params), [params])
  const reversed = periodIsReversed(filters)

  const members = useMembers(group.id)
  const expenses = useExpenses(group.id, filters, !reversed)
  const nameOf = memberNames(members.data)

  // the address bar is the single source of truth: every change reads the latest address, never a stale copy
  const update = (patch: Partial<ExpenseFilters>, { keepPage = false } = {}) =>
    setParams((previous) => serializeFilters({ ...parseFilters(previous), ...(keepPage ? {} : { page: 0 }), ...patch }), { replace: true })

  // the search box keeps what is typed; the server is only asked after a pause in the typing
  const [search, setSearch] = useState(filters.q)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const deleted = (location.state as { deleted?: boolean } | null)?.deleted === true
  const everyone = members.data ?? []

  return (
    <section className="space-y-6 pt-6">
      {deleted && <Alert variant="success">{t('expenses.deleted')}</Alert>}

      <div className="grid gap-4 rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200 sm:grid-cols-2 lg:grid-cols-3">
        <TextField
          label={t('expenses.filters.search')}
          placeholder={t('expenses.filters.searchPlaceholder')}
          value={search}
          maxLength={100}
          autoComplete="off"
          onChange={(event) => {
            const value = event.target.value
            setSearch(value)
            window.clearTimeout(timer.current)
            timer.current = window.setTimeout(() => update({ q: value }), SEARCH_DELAY_MS)
          }}
        />
        <SelectField
          label={t('expenses.filters.category')}
          value={filters.category}
          onChange={(event) => update({ category: event.target.value as ExpenseCategory | '' })}
        >
          <option value="">{t('expenses.filters.anyCategory')}</option>
          {EXPENSE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {t(`categories.${category}`)}
            </option>
          ))}
        </SelectField>
        <SelectField label={t('expenses.filters.paidBy')} value={filters.paidBy} onChange={(event) => update({ paidBy: event.target.value })}>
          <option value="">{t('expenses.filters.anyone')}</option>
          {everyone.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.fullName || m.username}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={t('expenses.filters.participant')}
          value={filters.participant}
          onChange={(event) => update({ participant: event.target.value })}
        >
          <option value="">{t('expenses.filters.anyone')}</option>
          {everyone.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.fullName || m.username}
            </option>
          ))}
        </SelectField>
        <TextField label={t('expenses.filters.from')} type="date" value={filters.from} onChange={(event) => update({ from: event.target.value })} />
        <TextField
          label={t('expenses.filters.to')}
          type="date"
          value={filters.to}
          error={reversed ? t('expenses.filters.reversed') : undefined}
          onChange={(event) => update({ to: event.target.value })}
        />
        {hasActiveFilters(filters) && (
          <div className="flex items-end">
            <Button
              variant="ghost"
              onClick={() => {
                window.clearTimeout(timer.current)
                setSearch('')
                setParams({}, { replace: true })
              }}
            >
              {t('expenses.filters.clear')}
            </Button>
          </div>
        )}
      </div>

      {!reversed && expenses.isPending && <LoadingState />}
      {!reversed && expenses.isError && <QueryErrorState error={expenses.error} onRetry={() => void expenses.refetch()} />}

      {!reversed && expenses.isSuccess && expenses.data.totalElements === 0 && (
        hasActiveFilters(filters) ? (
          <EmptyState title={t('expenses.noMatch.title')}>{t('expenses.noMatch.body')}</EmptyState>
        ) : (
          <EmptyState title={t('expenses.empty.title')}>{t('expenses.empty.body')}</EmptyState>
        )
      )}

      {!reversed && expenses.isSuccess && expenses.data.totalElements > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">{t('expenses.total', { count: expenses.data.totalElements })}</p>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            {expenses.data.items.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                payerName={nameOf(expense.paidBy)}
                myShareMinor={expense.shares.find((s) => s.userId === user?.id)?.shareMinor ?? null}
                listSearch={location.search}
              />
            ))}
          </ul>
          <Pagination
            page={expenses.data.page}
            totalPages={expenses.data.totalPages}
            onPage={(page) => update({ page }, { keepPage: true })}
          />
        </div>
      )}
    </section>
  )
}
