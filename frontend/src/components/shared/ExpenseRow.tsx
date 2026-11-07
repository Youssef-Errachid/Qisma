import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/format'
import type { ExpenseResponse } from '@/types/api'
import { Money } from './Money'

interface ExpenseRowProps {
  expense: ExpenseResponse
  payerName: string
  /** the share of the person looking at the list, or null when they take no part */
  myShareMinor: number | null
  /** the filters of the list, so that "back" from the detail returns to the same list */
  listSearch: string
}

export function ExpenseRow({ expense, payerName, myShareMinor, listSearch }: ExpenseRowProps) {
  const { t, i18n } = useTranslation()
  return (
    <li>
      <Link
        to={`/groups/${encodeURIComponent(expense.groupId)}/expenses/${encodeURIComponent(expense.id)}`}
        state={{ listSearch }}
        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:px-6"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-900">{expense.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
            <span>{formatDate(`${expense.expenseDate}T00:00:00Z`, i18n.resolvedLanguage ?? 'en')}</span>
            <Badge>{t(`categories.${expense.category}`)}</Badge>
            <span>{t('expenses.row.paidBy', { name: payerName })}</span>
          </p>
        </div>
        <div className="text-end">
          <p className="text-lg font-semibold text-slate-900">
            <Money minor={expense.amountMinor} currency={expense.currency} />
          </p>
          <p className="text-xs text-slate-500">
            {myShareMinor === null ? (
              t('expenses.row.notInvolved')
            ) : (
              <>
                {t('expenses.row.yourShare')}: <Money minor={myShareMinor} currency={expense.currency} />
              </>
            )}
          </p>
        </div>
      </Link>
    </li>
  )
}
