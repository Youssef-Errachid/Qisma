import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher'

export function AuthLayout() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10" style={{ background: 'var(--bg)' }}>
      <div className="mb-6 w-full max-w-md">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-600)' }}>{t('app.name')}</span>
          <LanguageSwitcher />
        </div>
        <p className="mt-1 text-sm" style={{ color: 'var(--ink-muted)' }}>{t('app.tagline')}</p>
      </div>
      <main className="q-card w-full max-w-md p-6 sm:p-8">
        <Outlet />
      </main>
    </div>
  )
}
