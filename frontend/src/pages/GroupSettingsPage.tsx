import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { ConfirmPanel } from '@/components/shared/ConfirmPanel'
import { FixLink } from '@/components/shared/FixLink'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/SelectField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { TextField } from '@/components/ui/TextField'
import { fieldMessage } from '@/features/auth/fieldMessage'
import { SUPPORTED_CURRENCIES } from '@/features/groups/currencies'
import { useArchiveGroup, useUpdateGroup } from '@/features/groups/lifecycle'
import { type GroupSettingsForm, groupSettingsSchema } from '@/features/groups/schemas'
import { useGroupContext } from '@/features/groups/useGroupContext'
import { ApiError } from '@/lib/api/errors'
import { errorMessage } from '@/lib/api/errorMessage'
import { currencyName } from '@/lib/format'

export function GroupSettingsPage() {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? 'en'
  const group = useGroupContext()
  const update = useUpdateGroup(group.id)
  const archive = useArchiveGroup(group.id)
  const [saved, setSaved] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const {
    register, handleSubmit, setError,
    formState: { errors },
  } = useForm<GroupSettingsForm>({
    resolver: zodResolver(groupSettingsSchema),
    defaultValues: { name: group.name, description: group.description ?? '', currency: group.currency },
  })

  if (group.myRole !== 'OWNER') {
    return <p className="pt-6 text-center text-slate-700">{t('settings.ownerOnly')}</p>
  }
  if (group.status !== 'ACTIVE') {
    return <p className="pt-6 text-center text-slate-700">{t('settings.archivedNote')}</p>
  }

  // a currency outside the menu (set through the API) is still shown, so the form never silently changes it
  const currencies = (SUPPORTED_CURRENCIES as readonly string[]).includes(group.currency) ? [...SUPPORTED_CURRENCIES] : [group.currency, ...SUPPORTED_CURRENCIES]

  const onSubmit = handleSubmit((values) => {
    setSaved(false)
    update.mutate(
      {
        name: values.name,
        description: values.description,
        ...(values.currency !== group.currency ? { currency: values.currency } : {}),
      },
      {
        onSuccess: () => setSaved(true),
        onError: (error) => {
          if (error instanceof ApiError) {
            error.fieldErrors.forEach((f) => {
              if (f.field === 'name' || f.field === 'description' || f.field === 'currency') setError(f.field, { message: f.message })
            })
          }
        },
      },
    )
  })

  const fieldLevel = update.error instanceof ApiError && update.error.fieldErrors.length > 0

  return (
    <section className="mx-auto max-w-xl space-y-10 pt-6">
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold">{t('settings.title')}</h2>
        {saved && !update.isPending && <Alert variant="success">{t('settings.saved')}</Alert>}
        {update.isError && !fieldLevel && <Alert variant="error">{errorMessage(t, update.error)}</Alert>}

        <TextField label={t('groups.create.name')} autoComplete="off" error={fieldMessage(t, errors.name?.message)} {...register('name')} />
        <TextAreaField label={t('groups.create.description')} error={fieldMessage(t, errors.description?.message)} {...register('description')} />
        <SelectField label={t('groups.create.currency')} error={fieldMessage(t, errors.currency?.message)} {...register('currency')}>
          {currencies.map((code) => (
            <option key={code} value={code}>{code} — {currencyName(code, language)}</option>
          ))}
        </SelectField>
        <p className="text-xs text-slate-500">{t('groups.create.currencyNote')}</p>

        <div className="flex justify-end">
          <Button type="submit" loading={update.isPending}>{t('settings.save')}</Button>
        </div>
      </form>

      <section aria-labelledby="archive-title" className="space-y-3">
        <h2 id="archive-title" className="text-lg font-semibold text-debt">{t('settings.dangerZone')}</h2>
        {archiving ? (
          <>
            <ConfirmPanel
              title={t('settings.archiveTitle')}
              confirmLabel={t('settings.archiveConfirm')}
              pending={archive.isPending}
              error={archive.isError ? errorMessage(t, archive.error) : undefined}
              onCancel={() => { setArchiving(false); archive.reset() }}
              onConfirm={() => archive.mutate()}
            >
              {t('settings.archiveBody')}
            </ConfirmPanel>
            <FixLink error={archive.error} groupId={group.id} />
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 ring-1 ring-rose-200">
            <p className="max-w-md text-sm text-slate-700">{t('settings.archiveHint')}</p>
            <Button variant="secondary" onClick={() => setArchiving(true)}>{t('settings.archive')}</Button>
          </div>
        )}
      </section>
    </section>
  )
}
