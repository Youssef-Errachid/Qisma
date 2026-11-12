import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Users, Globe } from 'lucide-react'
import { GroupCard } from '@/components/shared/GroupCard'
import { Button } from '@/components/ui/Button'
import { EmptyState, LoadingState, QueryErrorState } from '@/components/ui/StateViews'
import { sortGroups, useGroups } from '@/features/groups/queries'

type TabId = 'ACTIVE' | 'ARCHIVED'

export function GroupsPage() {
  const { t } = useTranslation()
  const groups = useGroups()
  const [activeTab, setActiveTab] = useState<TabId>('ACTIVE')

  const active = groups.data ? sortGroups(groups.data).filter((g) => g.status === 'ACTIVE') : []
  const archived = groups.data ? sortGroups(groups.data).filter((g) => g.status === 'ARCHIVED') : []
  const displayed = activeTab === 'ACTIVE' ? active : archived

  const uniqueCurrencies = groups.data
    ? [...new Set(groups.data.map((g) => g.currency))].length
    : 0

  return (
    <section className="space-y-6">

      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 34,
              fontWeight: 700,
              lineHeight: '40px',
              letterSpacing: '-0.01em',
              color: 'var(--ink)',
            }}
          >
            {t('groups.list.title')}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>
            {t('groups.list.subtitle')}
          </p>
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

      {/* Summary stat cards */}
      {groups.isSuccess && groups.data.length > 0 && (
        <div className="q-page-stats">
          <div className="q-page-stat">
            <div className="q-page-stat-icon">
              <Users size={24} strokeWidth={2} aria-hidden="true" />
            </div>
            <div>
              <div className="q-page-stat-num">{groups.data.length}</div>
              <div className="q-page-stat-label">Total Groups</div>
            </div>
          </div>

          <div className="q-page-stat">
            <div className="q-page-stat-icon" style={{ background: 'var(--owed-soft)', color: 'var(--owed)' }}>
              <Users size={24} strokeWidth={2} aria-hidden="true" />
            </div>
            <div>
              <div className="q-page-stat-num">{active.length}</div>
              <div className="q-page-stat-label">Active Groups</div>
            </div>
          </div>

          <div className="q-page-stat">
            <div className="q-page-stat-icon q-page-stat-icon--sky">
              <Globe size={24} strokeWidth={2} aria-hidden="true" />
            </div>
            <div>
              <div className="q-page-stat-num">{uniqueCurrencies}</div>
              <div className="q-page-stat-label">{uniqueCurrencies === 1 ? 'Currency' : 'Currencies'}</div>
            </div>
          </div>
        </div>
      )}

      {groups.isPending && <LoadingState />}
      {groups.isError && <QueryErrorState error={groups.error} onRetry={() => void groups.refetch()} />}

      {groups.isSuccess && (
        <>
          <div role="tablist" className="q-tabs">
            <button
              role="tab"
              className="q-tab"
              aria-selected={activeTab === 'ACTIVE'}
              onClick={() => setActiveTab('ACTIVE')}
            >
              {t('groups.tabs.active')} ({active.length})
            </button>
            <button
              role="tab"
              className="q-tab"
              aria-selected={activeTab === 'ARCHIVED'}
              onClick={() => setActiveTab('ARCHIVED')}
            >
              {t('groups.tabs.archived')} ({archived.length})
            </button>
          </div>

          {displayed.length === 0 ? (
            <EmptyState
              title={t('groups.list.emptyTitle')}
              action={
                activeTab === 'ACTIVE' ? (
                  <Link to="/groups/new">
                    <Button>{t('groups.list.new')}</Button>
                  </Link>
                ) : undefined
              }
            >
              {t('groups.list.emptyBody')}
            </EmptyState>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {displayed.map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
