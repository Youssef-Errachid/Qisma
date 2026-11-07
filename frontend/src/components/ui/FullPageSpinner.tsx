import { useTranslation } from 'react-i18next'
import { Spinner } from './Spinner'

export function FullPageSpinner() {
  const { t } = useTranslation()
  return (
    <div role="status" className="flex min-h-screen items-center justify-center text-slate-500">
      <Spinner className="h-8 w-8" />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  )
}
