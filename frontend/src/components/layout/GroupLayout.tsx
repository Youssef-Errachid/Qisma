import { Link, Outlet, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { GroupTabs } from '@/components/layout/GroupTabs'
import { Badge } from '@/components/ui/Badge'
import { LoadingState, QueryErrorState } from '@/components/ui/StateViews'
import { useGroup } from '@/features/groups/queries'
import { ApiError } from '@/lib/api/errors'

export function GroupLayout() {
  const { t } = useTranslation()
  const { groupId = '' } = useParams<{ groupId: string }>()
  const group = useGroup(groupId)

  if (group.isPending) {
    return <LoadingState />
  }
  if (group.isError) {
    if (group.error instanceof ApiError && group.error.status === 404) {
      return (
        <section className="space-y-4 text-center">
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--ink)' }}>
            {t('groups.notFound.title')}
          </h1>
          <p style={{ color: 'var(--ink-muted)' }}>{t('groups.notFound.body')}</p>
          <Link to="/groups" style={{ fontWeight: 600, color: 'var(--brand-600)' }} className="hover:underline">
            {t('groups.notFound.back')}
          </Link>
        </section>
      )
    }
    return <QueryErrorState error={group.error} onRetry={() => void group.refetch()} />
  }

  const { data } = group
  return (
    <section className="space-y-6">
      {/* Breadcrumb + group name */}
      <div>
        <Link
          to="/groups"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--ink-muted)',
            textDecoration: 'none',
            transition: 'color var(--duration-fast)',
          }}
          className="hover:underline"
        >
          <ChevronLeft size={15} strokeWidth={2} aria-hidden="true" />
          {t('nav.groups')}
        </Link>

        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'var(--ink)',
              lineHeight: '1.2',
            }}
          >
            {data.name}
          </h1>
          <Badge tone={data.myRole === 'OWNER' ? 'brand' : 'neutral'}>
            {t(`groups.role.${data.myRole}`)}
          </Badge>
          {data.status === 'ARCHIVED' && (
            <Badge tone="neutral">{t('groups.status.ARCHIVED')}</Badge>
          )}
        </div>
      </div>

      <GroupTabs showSettings={data.myRole === 'OWNER'} />
      <Outlet context={data} />
    </section>
  )
}
