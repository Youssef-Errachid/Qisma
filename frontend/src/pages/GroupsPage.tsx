import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { GroupCard } from '@/components/shared/GroupCard'
import { Button } from '@/components/ui/Button'
import { EmptyState, LoadingState, QueryErrorState } from '@/components/ui/StateViews'
import { sortGroups, useGroups } from '@/features/groups/queries'

export function GroupsPage() {
  const { t } = useTranslation()
  const groups = useGroups()

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('groups.list.title')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('groups.list.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/join">
            <Button variant="secondary">{t('groups.list.join')}</Button>
          </Link>
          <Link to="/groups/new">
            <Button>{t('groups.list.new')}</Button>
          </Link>
        </div>
      </div>

      {groups.isPending && <LoadingState />}
      {groups.isError && <QueryErrorState error={groups.error} onRetry={() => void groups.refetch()} />}
      {groups.isSuccess && groups.data.length === 0 && (
        <EmptyState
          title={t('groups.list.emptyTitle')}
          action={
            <Link to="/groups/new">
              <Button>{t('groups.list.new')}</Button>
            </Link>
          }
        >
          {t('groups.list.emptyBody')}
        </EmptyState>
      )}
      {groups.isSuccess && groups.data.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {sortGroups(groups.data).map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </ul>
      )}
    </section>
  )
}
