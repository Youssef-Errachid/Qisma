import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/SelectField'
import { TextField } from '@/components/ui/TextField'
import { changePassword, updateProfile } from '@/features/account/accountService'
import { type PasswordForm, type ProfileForm, passwordSchema, profileSchema } from '@/features/account/schemas'
import { fieldMessage } from '@/features/auth/fieldMessage'
import { useAuth } from '@/features/auth/useAuth'
import { setLanguage } from '@/i18n'
import { NATIVE_NAMES } from '@/i18n/resources'
import { ApiError } from '@/lib/api/errors'
import { errorMessage } from '@/lib/api/errorMessage'
import { LANGUAGES, type Language } from '@/types/api'

function ProfileCard() {
  const { t } = useTranslation()
  const { user, setUser } = useAuth()
  const [saved, setSaved] = useState(false)
  const {
    register, handleSubmit, setError,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: user?.fullName ?? '', preferredLanguage: user?.preferredLanguage ?? 'EN' },
  })
  const save = useMutation({ mutationFn: updateProfile })

  const onSubmit = handleSubmit((values) => {
    setSaved(false)
    save.mutate(values, {
      onSuccess: (updated) => {
        setUser(updated)
        // saving the language is choosing it: this device follows at once, and keeps it
        setLanguage(updated.preferredLanguage.toLowerCase() as 'fr' | 'en' | 'ar')
        setSaved(true)
      },
      onError: (error) => {
        if (error instanceof ApiError) {
          error.fieldErrors.forEach((f) => {
            if (f.field === 'fullName' || f.field === 'preferredLanguage') setError(f.field, { message: f.message })
          })
        }
      },
    })
  })
  const fieldLevel = save.error instanceof ApiError && save.error.fieldErrors.length > 0

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-semibold">{t('account.profile')}</h2>
      {saved && !save.isPending && <Alert variant="success">{t('account.saved')}</Alert>}
      {save.isError && !fieldLevel && <Alert variant="error">{errorMessage(t, save.error)}</Alert>}

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">{t('auth.fields.username')}</dt>
          <dd className="mt-0.5 font-medium text-slate-900">@{user?.username}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{t('auth.fields.email')}</dt>
          <dd className="mt-0.5 font-medium text-slate-900" dir="ltr">{user?.email}</dd>
        </div>
      </dl>

      <TextField label={t('auth.fields.fullName')} autoComplete="name" error={fieldMessage(t, errors.fullName?.message)} {...register('fullName')} />
      <SelectField label={t('account.language')} error={fieldMessage(t, errors.preferredLanguage?.message)} {...register('preferredLanguage')}>
        {LANGUAGES.map((code: Language) => (
          <option key={code} value={code}>{NATIVE_NAMES[code.toLowerCase() as 'fr' | 'en' | 'ar']}</option>
        ))}
      </SelectField>
      <div className="flex justify-end">
        <Button type="submit" loading={save.isPending}>{t('account.save')}</Button>
      </div>
    </form>
  )
}

function PasswordCard() {
  const { t } = useTranslation()
  const { endSession } = useAuth()
  const {
    register, handleSubmit, setError,
    formState: { errors },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' } })
  const change = useMutation({ mutationFn: changePassword })

  const onSubmit = handleSubmit((values) =>
    change.mutate(values, {
      // the server has ended every session of the account, this one included: sign in again, now
      onSuccess: () => endSession('passwordChanged'),
      onError: (error) => {
        if (error instanceof ApiError) {
          error.fieldErrors.forEach((f) => {
            if (f.field === 'currentPassword' || f.field === 'newPassword' || f.field === 'confirmNewPassword') setError(f.field, { message: f.message })
          })
        }
      },
    }),
  )
  const fieldLevel = change.error instanceof ApiError && change.error.fieldErrors.length > 0

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-semibold">{t('account.password')}</h2>
      <p className="text-sm text-slate-600">{t('account.passwordNote')}</p>
      {change.isError && !fieldLevel && <Alert variant="error">{errorMessage(t, change.error)}</Alert>}

      <TextField label={t('account.currentPassword')} type="password" autoComplete="current-password" error={fieldMessage(t, errors.currentPassword?.message)} {...register('currentPassword')} />
      <TextField label={t('account.newPassword')} type="password" autoComplete="new-password" hint={t('auth.hints.password')} error={fieldMessage(t, errors.newPassword?.message)} {...register('newPassword')} />
      <TextField label={t('account.confirmNewPassword')} type="password" autoComplete="new-password" error={fieldMessage(t, errors.confirmNewPassword?.message)} {...register('confirmNewPassword')} />
      <div className="flex justify-end">
        <Button type="submit" loading={change.isPending}>{t('account.changePassword')}</Button>
      </div>
    </form>
  )
}

export function AccountPage() {
  const { t } = useTranslation()
  return (
    <section className="mx-auto max-w-xl space-y-8">
      <h1 className="text-2xl font-semibold">{t('account.title')}</h1>
      <ProfileCard />
      <PasswordCard />
    </section>
  )
}
