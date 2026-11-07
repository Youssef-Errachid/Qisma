import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/SelectField'
import { LoadingState, QueryErrorState } from '@/components/ui/StateViews'
import { TextField } from '@/components/ui/TextField'
import { fieldMessage } from '@/features/auth/fieldMessage'
import { useAuth } from '@/features/auth/useAuth'
import { useBalances } from '@/features/balances/queries'
import { useGroupContext } from '@/features/groups/useGroupContext'
import { useMembers } from '@/features/members/queries'
import { useCreateSettlement } from '@/features/settlements/queries'
import { newFormId, requestKey, settlementCap } from '@/features/settlements/rules'
import { type SettlementFormValues, settlementSchema } from '@/features/settlements/schemas'
import { errorMessage } from '@/lib/api/errorMessage'
import { localeFor } from '@/lib/format'
import { formatMoney, fractionDigits, minorToInput, parseMoney } from '@/lib/money'
import type { BalancesResponse, MemberResponse } from '@/types/api'

interface FormProps {
  groupId: string
  currency: string
  me: string
  recipients: MemberResponse[]
  balances: BalancesResponse
  /** "?to=...&amount=..." from a suggestion */
  initialTo: string
  initialAmountMinor: number | null
}

function SettlementForm({ groupId, currency, me, recipients, balances, initialTo, initialAmountMinor }: FormProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const digits = fractionDigits(currency)
  const locale = localeFor(i18n.resolvedLanguage ?? 'en')
  const [formId] = useState(newFormId)

  const {
    register, handleSubmit,
    control,
    formState: { errors },
  } = useForm<SettlementFormValues>({
    resolver: zodResolver(settlementSchema(digits)),
    defaultValues: { toUserId: initialTo, amount: initialAmountMinor ? minorToInput(initialAmountMinor, digits) : '', note: '' },
  })

  const toUserId = useWatch({ control, name: 'toUserId' })
  const amountText = useWatch({ control, name: 'amount' })
  const note = useWatch({ control, name: 'note' })
  const amountMinor = parseMoney(amountText ?? '', digits)
  const cap = toUserId ? settlementCap(balances, me, toUserId) : null
  const overCap = amountMinor !== null && cap !== null && amountMinor > cap

  // the same repayment sent again carries the same key; a changed amount or person is a new request with a new key
  const key = requestKey(formId, { toUserId: toUserId ?? '', amountMinor: amountMinor ?? 0, note: note?.trim() || undefined })
  const create = useCreateSettlement(groupId, key)

  const onValid = (values: SettlementFormValues) => {
    if (amountMinor === null || overCap) {
      return
    }
    create.mutate(
      { toUserId: values.toUserId, amountMinor, ...(values.note ? { note: values.note } : {}) },
      {
        onSuccess: () => {
          const to = recipients.find((m) => m.userId === values.toUserId)
          navigate(`/groups/${encodeURIComponent(groupId)}/settlements`, { replace: true, state: { declaredTo: to?.fullName || to?.username || '' } })
        },
      },
    )
  }

  return (
    <form onSubmit={(event) => void handleSubmit(onValid)(event)} noValidate className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      {create.isError && <Alert variant="error">{errorMessage(t, create.error)}</Alert>}

      <SelectField label={t('settlementForm.to')} error={fieldMessage(t, errors.toUserId?.message)} {...register('toUserId')}>
        <option value="">{t('settlementForm.choose')}</option>
        {recipients.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.fullName || m.username}
          </option>
        ))}
      </SelectField>

      <div className="space-y-1.5">
        <TextField
          label={`${t('settlementForm.amount')} (${currency})`}
          inputMode="decimal"
          autoComplete="off"
          dir="ltr"
          placeholder="0.00"
          error={overCap ? t('settlementForm.exceeds', { amount: formatMoney(cap ?? 0, currency, locale) }) : fieldMessage(t, errors.amount?.message)}
          {...register('amount')}
        />
        {cap !== null && !overCap && (
          <p className="text-xs text-slate-500">
            {cap === 0 ? t('settlementForm.nothingOwed') : t('settlementForm.cap', { amount: formatMoney(cap, currency, locale) })}
          </p>
        )}
      </div>

      <TextField label={t('settlementForm.note')} maxLength={200} autoComplete="off" error={fieldMessage(t, errors.note?.message)} {...register('note')} />

      <div className="flex justify-end gap-3">
        <Link to={`/groups/${encodeURIComponent(groupId)}/settlements`}>
          <Button variant="ghost">{t('common.cancel')}</Button>
        </Link>
        <Button type="submit" loading={create.isPending}>
          {t('settlementForm.submit')}
        </Button>
      </div>
    </form>
  )
}

function Notice({ text, groupId }: { text: string; groupId: string }) {
  const { t } = useTranslation()
  return (
    <section className="space-y-4 pt-6 text-center">
      <p className="text-slate-700">{text}</p>
      <Link to={`/groups/${encodeURIComponent(groupId)}/settlements`} className="font-medium text-brand hover:underline">{t('settlementForm.back')}</Link>
    </section>
  )
}

export function NewSettlementPage() {
  const { t } = useTranslation()
  const group = useGroupContext()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const members = useMembers(group.id)
  const balances = useBalances(group.id)

  if (group.status !== 'ACTIVE') return <Notice text={t('settlementForm.archived')} groupId={group.id} />
  if (members.isPending || balances.isPending) return <LoadingState />
  if (members.isError) return <QueryErrorState error={members.error} onRetry={() => void members.refetch()} />
  if (balances.isError) return <QueryErrorState error={balances.error} onRetry={() => void balances.refetch()} />

  // anyone in the group can be paid, including someone who left: a debt to them still has to be settled
  const recipients = members.data.filter((m) => m.userId !== user?.id)
  if (!user || recipients.length === 0) return <Notice text={t('settlementForm.alone')} groupId={group.id} />

  const wanted = params.get('to') ?? ''
  const amount = Number(params.get('amount'))
  return (
    <section className="mx-auto max-w-xl space-y-6 pt-6">
      <div>
        <h2 className="text-2xl font-semibold">{t('settlementForm.title')}</h2>
        <p className="mt-1 text-sm text-slate-600">{t('settlementForm.subtitle')}</p>
      </div>
      <SettlementForm
        groupId={group.id}
        currency={group.currency}
        me={user.id}
        recipients={recipients}
        balances={balances.data}
        initialTo={recipients.some((m) => m.userId === wanted) ? wanted : ''}
        initialAmountMinor={Number.isSafeInteger(amount) && amount > 0 ? amount : null}
      />
    </section>
  )
}

