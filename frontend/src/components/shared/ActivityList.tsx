import { useTranslation } from 'react-i18next'
import { amountChange } from '@/features/activity/queries'
import { formatDateTime } from '@/lib/format'
import type { ActivityLine } from '@/types/api'
import { Money } from './Money'

/** A history, newest first: what happened, who did it, when, and what an amount changed from and to. */
export function ActivityList({ lines, currency }: { lines: readonly ActivityLine[]; currency: string }) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? 'en'
  return (
    <ol className="space-y-3">
      {lines.map((line) => {
        const change = amountChange(line.oldValue, line.newValue)
        return (
          <li key={line.id} className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <p className="font-medium text-slate-900">{t(`activity.actions.${line.action}`)}</p>
            <p className="mt-0.5 text-slate-500">
              {t('activity.by', { name: line.actorUsername })} · {formatDateTime(line.createdAt, language)}
            </p>
            {change && (
              <p className="mt-1 text-slate-700">
                {t('expenses.detail.amount')}: <Money minor={change[0]} currency={currency} /> →{' '}
                <Money minor={change[1]} currency={currency} />
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
