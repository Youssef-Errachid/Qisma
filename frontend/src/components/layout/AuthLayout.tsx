import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'

export function AuthLayout() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 w-full max-w-md">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold tracking-tight text-brand">{t('app.name')}</span>
          <LanguageSwitcher />
        </div>
        <p className="mt-1 text-sm text-slate-500">{t('app.tagline')}</p>
      </div>
      <main className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <Outlet />
      </main>
    </div>
  )
}
