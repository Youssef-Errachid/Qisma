import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { registerAccount } from '@/features/auth/authService'
import { fieldMessage } from '@/features/auth/fieldMessage'
import { type RegisterForm, registerSchema } from '@/features/auth/schemas'
import { ApiError } from '@/lib/api/errors'
import { errorMessage } from '@/lib/api/errorMessage'

const FORM_FIELDS: readonly string[] = ['username', 'fullName', 'email', 'password', 'confirmPassword']

function isFormField(name: string): name is keyof RegisterForm {
  return FORM_FIELDS.includes(name)
}

export function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', fullName: '', email: '', password: '', confirmPassword: '' },
  })

  const createAccount = useMutation({
    mutationFn: registerAccount,
    onSuccess: () => navigate('/login', { replace: true, state: { registered: true } }),
    onError: (error) => {
      if (!(error instanceof ApiError)) {
        return
      }
      // the server knows what the browser cannot: which e-mail or username is already taken
      if (error.code === 'EMAIL_ALREADY_USED') {
        setError('email', { message: 'errors.EMAIL_ALREADY_USED' })
      } else if (error.code === 'USERNAME_ALREADY_USED') {
        setError('username', { message: 'errors.USERNAME_ALREADY_USED' })
      } else {
        error.fieldErrors.filter((f) => isFormField(f.field)).forEach((f) => {
          if (isFormField(f.field)) {
            setError(f.field, { message: f.message })
          }
        })
      }
    },
  })

  const fieldLevelError =
    createAccount.error instanceof ApiError &&
    (createAccount.error.code === 'EMAIL_ALREADY_USED' ||
      createAccount.error.code === 'USERNAME_ALREADY_USED' ||
      createAccount.error.fieldErrors.length > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('auth.register.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('auth.register.subtitle')}</p>
      </div>

      {createAccount.isError && !fieldLevelError && <Alert variant="error">{errorMessage(t, createAccount.error)}</Alert>}

      <form onSubmit={handleSubmit((values) => createAccount.mutate(values))} noValidate className="space-y-4">
        <TextField
          label={t('auth.fields.fullName')}
          autoComplete="name"
          error={fieldMessage(t, errors.fullName?.message)}
          {...register('fullName')}
        />
        <TextField
          label={t('auth.fields.username')}
          autoComplete="username"
          hint={t('auth.hints.username')}
          error={fieldMessage(t, errors.username?.message)}
          {...register('username')}
        />
        <TextField
          label={t('auth.fields.email')}
          type="email"
          autoComplete="email"
          error={fieldMessage(t, errors.email?.message)}
          {...register('email')}
        />
        <TextField
          label={t('auth.fields.password')}
          type="password"
          autoComplete="new-password"
          hint={t('auth.hints.password')}
          error={fieldMessage(t, errors.password?.message)}
          {...register('password')}
        />
        <TextField
          label={t('auth.fields.confirmPassword')}
          type="password"
          autoComplete="new-password"
          error={fieldMessage(t, errors.confirmPassword?.message)}
          {...register('confirmPassword')}
        />
        <Button type="submit" loading={createAccount.isPending} className="w-full">
          {t('auth.register.submit')}
        </Button>
      </form>

      <p className="text-center text-sm text-slate-600">
        {t('auth.register.haveAccount')}{' '}
        <Link to="/login" className="font-medium text-brand hover:underline">
          {t('auth.register.signIn')}
        </Link>
      </p>
    </div>
  )
}
