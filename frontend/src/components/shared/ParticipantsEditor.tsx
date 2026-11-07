import { useTranslation } from 'react-i18next'
import { type Drafts, type SplitPlan } from '@/features/expenses/formModel'
import { localeFor } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import type { MemberResponse, SplitMethod } from '@/types/api'
import { Button } from '@/components/ui/Button'
import { Money } from './Money'

interface ParticipantsEditorProps {
  /** the active members, in the order that decides who gets the leftover centime */
  members: readonly MemberResponse[]
  method: SplitMethod
  drafts: Drafts
  plan: SplitPlan
  currency: string
  /** show what is wrong with each box (only after the user tried to save) */
  showIssues: boolean
  onDraft: (userId: string, patch: { selected?: boolean; value?: string }) => void
  onSelectAll: (selected: boolean) => void
  onFillEqually: () => void
}

export function ParticipantsEditor({ members, method, drafts, plan, currency, showIssues, onDraft, onSelectAll, onFillEqually }: ParticipantsEditorProps) {
  const { t, i18n } = useTranslation()
  const locale = localeFor(i18n.resolvedLanguage ?? 'en')
  const shareOf = new Map(plan.shares.map((share) => [share.userId, share.shareMinor]))
  const issueOf = (userId: string) => plan.issues.find((issue) => 'userId' in issue && issue.userId === userId)

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-slate-800">{t('expenseForm.participants')}</legend>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => onSelectAll(true)}>{t('expenseForm.selectEveryone')}</Button>
        <Button variant="ghost" onClick={() => onSelectAll(false)}>{t('expenseForm.selectNobody')}</Button>
        {method !== 'EQUAL' && <Button variant="secondary" onClick={onFillEqually}>{t('expenseForm.fillEqually')}</Button>}
      </div>

      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl ring-1 ring-slate-200">
        {members.map((member) => {
          const draft = drafts[member.userId] ?? { selected: false, value: '' }
          const name = member.fullName || member.username
          const issue = showIssues ? issueOf(member.userId) : undefined
          const share = shareOf.get(member.userId)
          return (
            <li key={member.userId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <label className="flex min-w-0 flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  checked={draft.selected}
                  onChange={(event) => onDraft(member.userId, { selected: event.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                <span className="truncate text-sm font-medium text-slate-900">{name}</span>
              </label>

              {method !== 'EQUAL' && draft.selected && (
                <div className="w-32">
                  <input
                    aria-label={t(method === 'CUSTOM' ? 'expenseForm.amountFor' : 'expenseForm.percentFor', { name })}
                    aria-invalid={issue ? true : undefined}
                    inputMode="decimal"
                    autoComplete="off"
                    dir="ltr"
                    value={draft.value}
                    placeholder={method === 'CUSTOM' ? '0.00' : '0 %'}
                    onChange={(event) => onDraft(member.userId, { value: event.target.value })}
                    className={`block w-full rounded-lg border-0 px-3 py-1.5 text-end text-sm tabular-nums ring-1 ring-inset focus:ring-2 focus:ring-inset ${
                      issue ? 'ring-debt focus:ring-debt' : 'ring-slate-300 focus:ring-brand'
                    }`}
                  />
                  {issue && (
                    <p className="mt-1 text-xs font-medium text-debt">
                      {issue.kind === 'VALUE_MISSING' ? t('expenseForm.issues.missing') : t('expenseForm.issues.invalid')}
                    </p>
                  )}
                </div>
              )}

              <span className="w-28 text-end text-sm tabular-nums text-slate-700" aria-label={t('expenseForm.shareOf', { name })}>
                {draft.selected && share !== undefined ? <Money minor={share} currency={currency} /> : '—'}
              </span>
            </li>
          )
        })}
      </ul>

      {method === 'CUSTOM' && plan.remaining !== null && (
        <p role="status" className={`text-sm font-medium ${plan.remaining === 0 ? 'text-credit' : 'text-debt'}`}>
          {plan.remaining === 0
            ? t('expenseForm.summary.allocated')
            : plan.remaining > 0
              ? t('expenseForm.summary.remaining', { amount: formatMoney(plan.remaining, currency, locale) })
              : t('expenseForm.summary.over', { amount: formatMoney(-plan.remaining, currency, locale) })}
        </p>
      )}
      {method === 'PERCENTAGE' && plan.remaining !== null && (
        <p role="status" className={`text-sm font-medium ${plan.remaining === 0 ? 'text-credit' : 'text-debt'}`}>
          {plan.remaining === 0
            ? t('expenseForm.summary.percentComplete')
            : plan.remaining > 0
              ? t('expenseForm.summary.percentMissing', { percent: (plan.remaining / 100).toFixed(2) })
              : t('expenseForm.summary.percentOver', { percent: (-plan.remaining / 100).toFixed(2) })}
        </p>
      )}
      {showIssues && plan.issues.some((issue) => issue.kind === 'NO_PARTICIPANTS') && (
        <p role="alert" className="text-sm font-medium text-debt">{t('expenseForm.issues.noParticipants')}</p>
      )}
    </fieldset>
  )
}
