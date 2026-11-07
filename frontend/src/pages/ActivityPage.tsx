import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ActivityList } from '@/components/shared/ActivityList'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { SelectField } from '@/components/ui/SelectField'
import { EmptyState, LoadingState, QueryErrorState } from '@/components/ui/StateViews'
import { TextField } from '@/components/ui/TextField'
import { type ActivityFilters, activityHref, activityPeriodIsReversed, hasActivityFilters, parseActivityFilters, serializeActivityFilters } from '@/features/activity/filters'
import { useActivity } from '@/features/activity/queries'
import { useGroupContext } from '@/features/groups/useGroupContext'
import { memberNames, useMembers } from '@/features/members/queries'
import { ACTIVITY_ACTIONS, type ActivityAction } from '@/types/api'

export function ActivityPage() {
  const { t } = useTranslation()
  const group = useGroupContext()
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseActivityFilters(params), [params])
  const reversed = activityPeriodIsReversed(filters)
  const members = useMembers(group.id)
  const activity = useActivity(group.id, filters, !reversed)
  const nameOf = memberNames(members.data)

  // the address bar is the single source of truth: every change reads the latest address
  const update = (patch: Partial<ActivityFilters>, { keepPage = false } = {}) =>
    setParams((previous) => serializeActivityFilters({ ...parseActivityFilters(previous), ...(keepPage ? {} : { page: 0 }), ...patch }), { replace: true })

  return (
    <section className="space-y-6 pt-6">
      <div className="grid gap-4 rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField label={t('activityPage.action')} value={filters.action} onChange={(event) => update({ action: event.target.value as ActivityAction | '' })}>
          <option value="">{t('activityPage.anyAction')}</option>
          {ACTIVITY_ACTIONS.map((action) => (
            <option key={action} value={action}>{t(`activity.actions.${action}`)}</option>
          ))}
        </SelectField>
        <SelectField label={t('activityPage.actor')} value={filters.actorId} onChange={(event) => update({ actorId: event.target.value })}>
          <option value="">{t('expenses.filters.anyone')}</option>
          {(members.data ?? []).map((m) => (
            <option key={m.userId} value={m.userId}>{m.fullName || m.username}</option>
          ))}
        </SelectField>
        <div className="hidden lg:block" />
        <TextField label={t('expenses.filters.from')} type="date" value={filters.from} onChange={(event) => update({ from: event.target.value })} />
        <TextField label={t('expenses.filters.to')} type="date" value={filters.to} error={reversed ? t('expenses.filters.reversed') : undefined} onChange={(event) => update({ to: event.target.value })} />
        {hasActivityFilters(filters) && (
          <div className="flex items-end">
            <Button variant="ghost" onClick={() => setParams({}, { replace: true })}>{t('expenses.filters.clear')}</Button>
          </div>
        )}
      </div>

      {!reversed && activity.isPending && <LoadingState />}
      {!reversed && activity.isError && <QueryErrorState error={activity.error} onRetry={() => void activity.refetch()} />}
      {!reversed && activity.isSuccess && activity.data.totalElements === 0 && (
        hasActivityFilters(filters) ? <EmptyState title={t('activityPage.noMatch')} /> : <EmptyState title={t('activityPage.empty')} />
      )}
      {!reversed && activity.isSuccess && activity.data.totalElements > 0 && (
        <div className="space-y-4">
          <ActivityList
            lines={activity.data.items}
            currency={group.currency}
            nameOf={(id, fallback) => (members.data ? nameOf(id) : fallback)}
            hrefOf={(line) => activityHref(group.id, line)}
          />
          <Pagination page={activity.data.page} totalPages={activity.data.totalPages} onPage={(page) => update({ page }, { keepPage: true })} />
        </div>
      )}
    </section>
  )
}
