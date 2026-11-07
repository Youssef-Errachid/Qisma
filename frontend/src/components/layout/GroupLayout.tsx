import { Link, Outlet, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { GroupTabs } from '@/components/layout/GroupTabs'
import { Badge } from '@/components/ui/Badge'
import { LoadingState, QueryErrorState } from '@/components/ui/StateViews'
import { useGroup } from '@/features/groups/queries'
import { ApiError } from '@/lib/api/errors'

/** Everything that happens inside one group. Loads the group once and hands it to the screens below. */
export function GroupLayout() {
  const { t } = useTranslation()
  const { groupId = '' } = useParams<{ groupId: string }>()
  const group = useGroup(groupId)

  if (group.isPending) {
    return <LoadingState />
  }
  if (group.isError) {
    // the server answers 404 both for a group that does not exist and for one the user does not belong to
    if (group.error instanceof ApiError && group.error.status === 404) {
      return (
        <section className="space-y-4 text-center">
          <h1 className="text-2xl font-semibold">{t('groups.notFound.title')}</h1>
          <p className="text-slate-600">{t('groups.notFound.body')}</p>
          <Link to="/groups" className="font-medium text-brand hover:underline">
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
      <div>
        <Link to="/groups" className="text-sm font-medium text-slate-500 hover:text-slate-700">
          ← {t('nav.groups')}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{data.name}</h1>
          <Badge tone={data.myRole === 'OWNER' ? 'brand' : 'neutral'}>{t(`groups.role.${data.myRole}`)}</Badge>
          {data.status === 'ARCHIVED' && <Badge tone="warning">{t('groups.status.ARCHIVED')}</Badge>}
        </div>
      </div>
      <GroupTabs />
      <Outlet context={data} />
    </section>
  )
}
