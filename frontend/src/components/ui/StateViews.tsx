import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { errorMessage } from '@/lib/api/errorMessage'
import { Button } from './Button'
import { Spinner } from './Spinner'

/** A section is loading. Announced to screen readers, never an empty flash. */
export function LoadingState() {
  const { t } = useTranslation()
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-slate-500">
      <Spinner className="h-6 w-6" />
      <span>{t('common.loading')}</span>
    </div>
  )
}

/** A section could not be loaded: say why, in the user's language, and offer to try again. */
export function QueryErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="rounded-xl bg-debt-soft p-6 text-center ring-1 ring-inset ring-rose-200">
      <p className="text-sm text-debt">{errorMessage(t, error)}</p>
      <Button variant="secondary" onClick={onRetry} className="mt-4">
        {t('common.retry')}
      </Button>
    </div>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {children && <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{children}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  )
}
