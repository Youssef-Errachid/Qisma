import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { fieldMessage } from '@/features/auth/fieldMessage'
import { type LoginForm, loginSchema } from '@/features/auth/schemas'
import { useAuth } from '@/features/auth/useAuth'
import { errorMessage } from '@/lib/api/errorMessage'

interface LoginLocationState {
  registered?: boolean
}

export function LoginPage() {
  const { t } = useTranslation()
  const { login, notice } = useAuth()
  const location = useLocation()
  const justRegistered = (location.state as LoginLocationState | null)?.registered === true

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  // when this succeeds the session changes and the route guard sends the user on: nothing to navigate to here
  const signIn = useMutation({ mutationFn: login })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{t('auth.login.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('auth.login.subtitle')}</p>
      </div>

      {justRegistered && <Alert variant="success">{t('auth.login.registered')}</Alert>}
      {notice === 'passwordChanged' && <Alert variant="success">{t('auth.login.passwordChanged')}</Alert>}
      {signIn.isError && <Alert variant="error">{errorMessage(t, signIn.error)}</Alert>}

      <form onSubmit={handleSubmit((values) => signIn.mutate(values))} noValidate className="space-y-4">
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
          autoComplete="current-password"
          error={fieldMessage(t, errors.password?.message)}
          {...register('password')}
        />
        <Button type="submit" loading={signIn.isPending} className="w-full">
          {t('auth.login.submit')}
        </Button>
      </form>

      <p className="text-center text-sm text-slate-600">
        {t('auth.login.noAccount')}{' '}
        <Link to="/register" className="font-medium text-brand hover:underline">
          {t('auth.login.createAccount')}
        </Link>
      </p>
    </div>
  )
}
