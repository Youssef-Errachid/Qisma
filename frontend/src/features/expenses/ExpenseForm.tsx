import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ParticipantsEditor } from '@/components/shared/ParticipantsEditor'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/SelectField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { TextField } from '@/components/ui/TextField'
import { fieldMessage } from '@/features/auth/fieldMessage'
import { ApiError } from '@/lib/api/errors'
import { errorMessage } from '@/lib/api/errorMessage'
import { todayIso } from '@/lib/format'
import { fractionDigits, minorToInput, parseMoney } from '@/lib/money'
import { EXPENSE_CATEGORIES, type ExpenseCategory, type ExpenseRequest, type ExpenseResponse, type GroupResponse, type MemberResponse, SPLIT_METHODS, type SplitMethod } from '@/types/api'
import { type Drafts, allSelected, draftsFromExpense, fillEqually, planSplit, toParticipantInputs } from './formModel'
import { expenseKeys, useCreateExpense, useUpdateExpense } from './queries'
import { type ExpenseFormValues, expenseSchema } from './schemas'

interface ExpenseFormProps {
  group: GroupResponse
  /** the ACTIVE members, in the order that decides who gets the leftover centime */
  members: readonly MemberResponse[]
  /** every member, active or not, to name people who are no longer in the group */
  everyone: readonly MemberResponse[]
  userId: string
  /** present when editing */
  expense?: ExpenseResponse
}

const FIELD_ERRORS: Record<string, keyof ExpenseFormValues> = {
  title: 'title', description: 'description', amountMinor: 'amount', expenseDate: 'expenseDate',
  category: 'category', paidBy: 'paidBy', splitMethod: 'splitMethod',
}

export function ExpenseForm({ group, members, everyone, userId, expense }: ExpenseFormProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const digits = fractionDigits(group.currency)
  const memberIds = members.map((m) => m.userId)
  const editing = expense !== undefined

  const create = useCreateExpense(group.id)
  const update = useUpdateExpense(group.id, expense?.id ?? '')
  const save = editing ? update : create

  const [today] = useState(() => todayIso())
  const [start] = useState(() => (expense ? draftsFromExpense(expense, memberIds, digits) : { drafts: allSelected(memberIds), leftOut: [] as string[] }))
  const [drafts, setDrafts] = useState<Drafts>(start.drafts)
  const [attempted, setAttempted] = useState(false)

  const payerIsActive = memberIds.includes(expense?.paidBy ?? userId)
  const {
    register, handleSubmit, setError, setValue, control,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema(digits)),
    defaultValues: {
      title: expense?.title ?? '',
      description: expense?.description ?? '',
      amount: expense ? minorToInput(expense.amountMinor, digits) : '',
      expenseDate: expense?.expenseDate ?? today,
      category: expense?.category ?? 'FOOD',
      paidBy: payerIsActive ? (expense?.paidBy ?? userId) : '',
      splitMethod: expense?.splitMethod ?? 'EQUAL',
    },
  })

  const amountText = useWatch({ control, name: 'amount' })
  const method = useWatch({ control, name: 'splitMethod' })
  const amountMinor = parseMoney(amountText ?? '', digits)
  const plan = planSplit({ method, amountMinor, memberIds, drafts, digits })

  function onDraft(id: string, patch: { selected?: boolean; value?: string }) {
    setDrafts((previous) => ({ ...previous, [id]: { ...previous[id], ...patch } }))
  }

  function chooseMethod(next: SplitMethod) {
    setValue('splitMethod', next, { shouldDirty: true })
    // switching to amounts or percentages: start from the equal split instead of empty boxes
    const nothingTyped = memberIds.every((id) => !drafts[id]?.selected || drafts[id].value === '')
    if (next !== 'EQUAL' && nothingTyped) {
      setDrafts((previous) => fillEqually(next, amountMinor, memberIds, previous, digits))
    }
  }

  const onValid = (values: ExpenseFormValues) => {
    if (plan.issues.length > 0 || amountMinor === null) {
      return
    }
    const request: ExpenseRequest = {
      title: values.title,
      ...(values.description ? { description: values.description } : {}),
      amountMinor,
      paidBy: values.paidBy,
      expenseDate: values.expenseDate,
      category: values.category as ExpenseCategory,
      splitMethod: values.splitMethod,
      participants: toParticipantInputs(values.splitMethod, plan.shares),
    }
    const options = {
      onSuccess: (saved: ExpenseResponse) => navigate(`/groups/${encodeURIComponent(group.id)}/expenses/${encodeURIComponent(saved.id)}`),
      onError: (error: unknown) => {
        if (error instanceof ApiError) {
          error.fieldErrors.forEach((f) => {
            const field = FIELD_ERRORS[f.field]
            if (field) setError(field, { message: f.message })
          })
        }
      },
    }
    if (expense) {
      update.mutate({ ...request, version: expense.version }, options)
    } else {
      create.mutate(request, options)
    }
  }

  const error = save.error
  const conflict = error instanceof ApiError && error.code === 'VERSION_CONFLICT'
  const fieldLevel = error instanceof ApiError && error.fieldErrors.length > 0
  const nameOf = (id: string) => everyone.find((m) => m.userId === id)?.fullName ?? '?'
  const detailPath = `/groups/${encodeURIComponent(group.id)}/expenses${expense ? `/${encodeURIComponent(expense.id)}` : ''}`

  return (
    <form
      onSubmit={(event) => {
        setAttempted(true)
        void handleSubmit(onValid)(event)
      }}
      noValidate
      className="space-y-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
    >
      {conflict && (
        <div className="space-y-3">
          <Alert variant="error">{t('expenseForm.conflict.message')}</Alert>
          <Button
            variant="secondary"
            onClick={() => {
              save.reset()
              if (expense) void queryClient.invalidateQueries({ queryKey: expenseKeys.detail(group.id, expense.id) })
            }}
          >
            {t('expenseForm.conflict.reload')}
          </Button>
        </div>
      )}
      {save.isError && !conflict && !fieldLevel && <Alert variant="error">{errorMessage(t, error)}</Alert>}
      {editing && !payerIsActive && <Alert variant="error">{t('expenseForm.payerLeft')}</Alert>}
      {start.leftOut.length > 0 && (
        <Alert variant="error">{t('expenseForm.leftOut', { names: start.leftOut.map(nameOf).join(', ') })}</Alert>
      )}

      <TextField label={t('expenseForm.fields.title')} autoComplete="off" error={fieldMessage(t, errors.title?.message)} {...register('title')} />
      <TextAreaField label={t('expenseForm.fields.description')} error={fieldMessage(t, errors.description?.message)} {...register('description')} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={`${t('expenseForm.fields.amount')} (${group.currency})`}
          inputMode="decimal"
          autoComplete="off"
          dir="ltr"
          placeholder="0.00"
          error={fieldMessage(t, errors.amount?.message)}
          {...register('amount')}
        />
        <TextField label={t('expenseForm.fields.date')} type="date" error={fieldMessage(t, errors.expenseDate?.message)} {...register('expenseDate')} />
        <SelectField label={t('expenseForm.fields.category')} error={fieldMessage(t, errors.category?.message)} {...register('category')}>
          {EXPENSE_CATEGORIES.map((category) => (
            <option key={category} value={category}>{t(`categories.${category}`)}</option>
          ))}
        </SelectField>
        <SelectField label={t('expenseForm.fields.paidBy')} error={fieldMessage(t, errors.paidBy?.message)} {...register('paidBy')}>
          <option value="">{t('expenseForm.fields.choosePayer')}</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>{m.fullName || m.username}</option>
          ))}
        </SelectField>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-800">{t('expenseForm.split.legend')}</legend>
        <div className="flex flex-wrap gap-3">
          {SPLIT_METHODS.map((option) => (
            <label key={option} className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm ring-1 ring-inset ${method === option ? 'bg-credit-soft text-credit ring-emerald-300' : 'text-slate-700 ring-slate-300 hover:bg-slate-50'}`}>
              <input type="radio" name="splitMethod" value={option} checked={method === option} onChange={() => chooseMethod(option)} className="text-brand focus:ring-brand" />
              {t(`expenseForm.split.${option}`)}
            </label>
          ))}
        </div>
      </fieldset>

      {amountMinor === null && attempted && <p className="text-sm text-slate-500">{t('expenseForm.issues.amountFirst')}</p>}
      <ParticipantsEditor
        members={members}
        method={method}
        drafts={drafts}
        plan={plan}
        currency={group.currency}
        showIssues={attempted}
        onDraft={onDraft}
        onSelectAll={(selected) => setDrafts((previous) => Object.fromEntries(memberIds.map((id) => [id, { ...previous[id], selected }])))}
        onFillEqually={() => setDrafts((previous) => fillEqually(method, amountMinor, memberIds, previous, digits))}
      />

      <div className="flex justify-end gap-3">
        <Link to={detailPath}>
          <Button variant="ghost">{t('common.cancel')}</Button>
        </Link>
        <Button type="submit" loading={save.isPending}>
          {editing ? t('expenseForm.submitSave') : t('expenseForm.submitCreate')}
        </Button>
      </div>
    </form>
  )
}
