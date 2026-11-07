import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/SelectField'
import { TextAreaField } from '@/components/ui/TextAreaField'
import { TextField } from '@/components/ui/TextField'
import { fieldMessage } from '@/features/auth/fieldMessage'
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from '@/features/groups/currencies'
import { useCreateGroup } from '@/features/groups/queries'
import { type CreateGroupForm, createGroupSchema } from '@/features/groups/schemas'
import { ApiError } from '@/lib/api/errors'
import { errorMessage } from '@/lib/api/errorMessage'
import { currencyName } from '@/lib/format'

export function CreateGroupPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const language = i18n.resolvedLanguage ?? 'en'
  const createGroup = useCreateGroup()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CreateGroupForm>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { name: '', description: '', currency: DEFAULT_CURRENCY },
  })

  const onSubmit = handleSubmit((values) =>
    createGroup.mutate(
      { name: values.name, currency: values.currency, ...(values.description ? { description: values.description } : {}) },
      {
        onSuccess: (group) => navigate(`/groups/${encodeURIComponent(group.id)}`, { replace: true }),
        onError: (error) => {
          if (error instanceof ApiError) {
            error.fieldErrors.forEach((f) => {
              if (f.field === 'name' || f.field === 'description' || f.field === 'currency') {
                setError(f.field, { message: f.message })
              }
            })
          }
        },
      },
    ),
  )

  const showAlert =
    createGroup.isError && !(createGroup.error instanceof ApiError && createGroup.error.fieldErrors.length > 0)

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('groups.create.title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('groups.create.subtitle')}</p>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        {showAlert && <Alert variant="error">{errorMessage(t, createGroup.error)}</Alert>}

        <TextField
          label={t('groups.create.name')}
          autoComplete="off"
          error={fieldMessage(t, errors.name?.message)}
          {...register('name')}
        />
        <TextAreaField
          label={t('groups.create.description')}
          error={fieldMessage(t, errors.description?.message)}
          {...register('description')}
        />
        <SelectField
          label={t('groups.create.currency')}
          error={fieldMessage(t, errors.currency?.message)}
          {...register('currency')}
        >
          {SUPPORTED_CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code} — {currencyName(code, language)}
            </option>
          ))}
        </SelectField>
        <p className="text-xs text-slate-500">{t('groups.create.currencyNote')}</p>

        <div className="flex justify-end gap-3">
          <Link to="/groups">
            <Button variant="ghost">{t('common.cancel')}</Button>
          </Link>
          <Button type="submit" loading={createGroup.isPending}>
            {t('groups.create.submit')}
          </Button>
        </div>
      </form>
    </section>
  )
}
