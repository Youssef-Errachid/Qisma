import { useTranslation } from 'react-i18next'
import { useGroupContext } from '@/features/groups/useGroupContext'
import { currencyName, formatDate } from '@/lib/format'

export function GroupOverviewPage() {
  const { t, i18n } = useTranslation()
  const group = useGroupContext()
  const language = i18n.resolvedLanguage ?? 'en'

  const rows: Array<[string, string]> = [
    [t('groups.overview.currency'), `${group.currency} — ${currencyName(group.currency, language)}`],
    [t('groups.overview.role'), t(`groups.role.${group.myRole}`)],
    [t('groups.overview.status'), t(`groups.status.${group.status}`)],
    [t('groups.overview.created'), formatDate(group.createdAt, language)],
  ]

  return (
    <div className="space-y-6">
      {group.description && <p className="text-slate-700">{group.description}</p>}
      <dl className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-slate-500">{label}</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-slate-500">{t('groups.overview.soon')}</p>
    </div>
  )
}
