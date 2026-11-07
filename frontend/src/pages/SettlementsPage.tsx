import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SettlementCard } from '@/components/shared/SettlementCard'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { SelectField } from '@/components/ui/SelectField'
import { EmptyState, LoadingState, QueryErrorState } from '@/components/ui/StateViews'
import { useAuth } from '@/features/auth/useAuth'
import { useGroupContext } from '@/features/groups/useGroupContext'
import { useMembers } from '@/features/members/queries'
import { type SettlementFilters, usePendingSettlements, useSettlements } from '@/features/settlements/queries'
import { SETTLEMENT_STATUSES, type SettlementStatus } from '@/types/api'

function readFilters(params: URLSearchParams): SettlementFilters {
  const status = params.get('status') ?? ''
  const page = Number(params.get('page') ?? '0')
  return {
    status: (SETTLEMENT_STATUSES as readonly string[]).includes(status) ? (status as SettlementStatus) : '',
    page: Number.isInteger(page) && page > 0 ? page : 0,
  }
}

export function SettlementsPage() {
  const { t } = useTranslation()
  const group = useGroupContext()
  const { user } = useAuth()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const filters = readFilters(params)

  const members = useMembers(group.id)
  const pending = usePendingSettlements(group.id)
  const history = useSettlements(group.id, filters)

  const byId = new Map((members.data ?? []).map((m) => [m.userId, m.fullName || m.username]))
  const nameOf = (id: string, fallback: string) => byId.get(id) ?? fallback
  const groupActive = group.status === 'ACTIVE'
  const declaredTo = (location.state as { declaredTo?: string } | null)?.declaredTo

  const setFilters = (next: Partial<SettlementFilters>) => {
    const merged = { ...filters, page: 0, ...next }
    const search = new URLSearchParams()
    if (merged.status) search.set('status', merged.status)
    if (merged.page > 0) search.set('page', String(merged.page))
    setParams(search, { replace: true })
  }

  return (
    <section className="space-y-8 pt-6">
      {declaredTo && <Alert variant="success">{t('settlements.declared', { name: declaredTo })}</Alert>}

      {groupActive && (
        <div className="flex justify-end">
          <Link to="new">
            <Button>{t('settlements.declare')}</Button>
          </Link>
        </div>
      )}

      <section aria-labelledby="waiting-title" className="space-y-3">
        <h2 id="waiting-title" className="text-lg font-semibold">{t('settlements.waiting')}</h2>
        {pending.isPending && <LoadingState />}
        {pending.isError && <QueryErrorState error={pending.error} onRetry={() => void pending.refetch()} />}
        {pending.isSuccess && pending.data.items.length === 0 && (
          <p className="rounded-2xl bg-white p-5 text-sm text-slate-600 shadow-xs ring-1 ring-slate-200">{t('settlements.nothingWaiting')}</p>
        )}
        {pending.isSuccess && pending.data.items.length > 0 && (
          <ul className="space-y-3">
            {pending.data.items.map((s) => (
              <SettlementCard key={s.id} settlement={s} groupId={group.id} me={user?.id} nameOf={nameOf} groupActive={groupActive} showActions />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="history-title" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="history-title" className="text-lg font-semibold">{t('settlements.history')}</h2>
          <div className="w-44">
            <SelectField label={t('settlements.filterStatus')} value={filters.status} onChange={(event) => setFilters({ status: event.target.value as SettlementStatus | '' })}>
              <option value="">{t('settlements.allStatuses')}</option>
              {SETTLEMENT_STATUSES.map((status) => (
                <option key={status} value={status}>{t(`settlements.status.${status}`)}</option>
              ))}
            </SelectField>
          </div>
        </div>
        {history.isPending && <LoadingState />}
        {history.isError && <QueryErrorState error={history.error} onRetry={() => void history.refetch()} />}
        {history.isSuccess && history.data.totalElements === 0 && <EmptyState title={t('settlements.historyEmpty')} />}
        {history.isSuccess && history.data.totalElements > 0 && (
          <>
            <ul className="space-y-3">
              {history.data.items.map((s) => (
                <SettlementCard key={s.id} settlement={s} groupId={group.id} me={user?.id} nameOf={nameOf} groupActive={groupActive} showActions={false} />
              ))}
            </ul>
            <Pagination page={history.data.page} totalPages={history.data.totalPages} onPage={(page) => setFilters({ page })} />
          </>
        )}
      </section>
    </section>
  )
}
