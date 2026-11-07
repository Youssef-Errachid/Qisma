import { useTranslation } from 'react-i18next'
import { currencyName, formatDate } from '@/lib/format'
import type { GroupResponse } from '@/types/api'

export function GroupDetails({ group }: { group: GroupResponse }) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? 'en'
  const rows: Array<[string, string]> = [
    [t('groups.overview.currency'), `${group.currency} — ${currencyName(group.currency, language)}`],
    [t('groups.overview.role'), t(`groups.role.${group.myRole}`)],
    [t('groups.overview.status'), t(`groups.status.${group.status}`)],
    [t('groups.overview.created'), formatDate(group.createdAt, language)],
  ]
  return (
    <section aria-labelledby="group-details-title" className="space-y-3">
      <h2 id="group-details-title" className="text-base font-semibold text-slate-900">
        {t('groups.overview.title')}
      </h2>
      {group.description && <p className="text-slate-700">{group.description}</p>}
      <dl className="grid gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-sm text-slate-500">{label}</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
