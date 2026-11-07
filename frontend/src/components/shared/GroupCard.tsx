import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/format'
import type { GroupResponse } from '@/types/api'

export function GroupCard({ group }: { group: GroupResponse }) {
  const { t, i18n } = useTranslation()
  return (
    <li>
      <Link
        to={`/groups/${encodeURIComponent(group.id)}`}
        className="block h-full rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200 transition hover:shadow-md hover:ring-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">{group.name}</h2>
          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{group.currency}</span>
        </div>
        {group.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{group.description}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone={group.myRole === 'OWNER' ? 'brand' : 'neutral'}>{t(`groups.role.${group.myRole}`)}</Badge>
          {group.status === 'ARCHIVED' && <Badge tone="warning">{t('groups.status.ARCHIVED')}</Badge>}
          <span className="ms-auto text-xs text-slate-500">{formatDate(group.createdAt, i18n.resolvedLanguage ?? 'en')}</span>
        </div>
      </Link>
    </li>
  )
}
