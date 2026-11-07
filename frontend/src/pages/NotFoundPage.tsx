import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">{t('notFound.title')}</h1>
      <Link to="/" className="font-medium text-brand hover:underline">
        {t('notFound.back')}
      </Link>
    </main>
  )
}
