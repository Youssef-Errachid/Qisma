import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'

interface ConfirmPanelProps {
  title: string
  children?: ReactNode
  confirmLabel: string
  pending?: boolean
  /** an already translated message, shown when the action failed */
  error?: string
  onConfirm: () => void
  onCancel: () => void
  /** 'danger' for what cannot be undone */
  tone?: 'danger' | 'neutral'
}

/** An inline "are you sure?", for actions that change a group for everybody. Not a modal: nothing traps the focus. */
export function ConfirmPanel({ title, children, confirmLabel, pending = false, error, onConfirm, onCancel, tone = 'danger' }: ConfirmPanelProps) {
  const { t } = useTranslation()
  const colours = tone === 'danger' ? 'bg-debt-soft ring-rose-200' : 'bg-slate-50 ring-slate-200'
  return (
    <div role="group" aria-label={title} className={`space-y-3 rounded-2xl p-5 ring-1 ring-inset ${colours}`}>
      <p className={`font-semibold ${tone === 'danger' ? 'text-debt' : 'text-slate-900'}`}>{title}</p>
      {children && <div className="text-sm text-slate-700">{children}</div>}
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex flex-wrap gap-3">
        <Button variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}
