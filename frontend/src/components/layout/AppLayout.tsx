import { useMutation } from '@tanstack/react-query'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/useAuth'
import { errorMessage } from '@/lib/api/errorMessage'

const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'text-brand' : 'hover:text-slate-900')

export function AppLayout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const signOut = useMutation({ mutationFn: logout })

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <Link to="/groups" className="text-xl font-bold tracking-tight text-brand">
              {t('app.name')}
            </Link>
            <nav aria-label={t('nav.main')} className="flex items-center gap-4 text-sm font-medium text-slate-600">
              <NavLink to="/groups" end className={navClass}>
                {t('nav.groups')}
              </NavLink>
              <NavLink to="/join" className={navClass}>
                {t('nav.join')}
              </NavLink>
              <NavLink to="/account" className={navClass}>
                {t('nav.account')}
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <span className="hidden text-sm text-slate-600 sm:inline">{user?.fullName}</span>
            <Button variant="secondary" loading={signOut.isPending} onClick={() => signOut.mutate()}>
              {t('common.logout')}
            </Button>
          </div>
        </div>
      </header>
      {signOut.isError && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <Alert variant="error">{t('common.logoutFailed')} {errorMessage(t, signOut.error)}</Alert>
        </div>
      )}
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
