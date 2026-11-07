import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { amountChange } from '@/features/activity/queries'
import { formatDateTime } from '@/lib/format'
import type { ActivityLine } from '@/types/api'
import { Money } from './Money'

/** A history, newest first: what happened, who did it, when, and what an amount changed from and to. */
interface ActivityListProps {
  lines: readonly ActivityLine[]
  currency: string
  /** the name to show for the person who acted; the username when absent */
  nameOf?: (userId: string, fallback: string) => string
  /** where the line leads, or null when nothing can be opened */
  hrefOf?: (line: ActivityLine) => string | null
}

export function ActivityList({ lines, currency, nameOf, hrefOf }: ActivityListProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? 'en'
  return (
    <ol className="space-y-3">
      {lines.map((line) => {
        const change = amountChange(line.oldValue, line.newValue)
        const href = hrefOf?.(line) ?? null
        const label = t(`activity.actions.${line.action}`)
        return (
          <li key={line.id} className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <p className="font-medium text-slate-900">
              {href ? <Link to={href} className="hover:underline">{label}</Link> : label}
            </p>
            <p className="mt-0.5 text-slate-500">
              {t('activity.by', { name: nameOf ? nameOf(line.actorId, line.actorUsername) : line.actorUsername })} · {formatDateTime(line.createdAt, language)}
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
