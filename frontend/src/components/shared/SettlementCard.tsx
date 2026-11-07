import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { actionsFor } from '@/features/settlements/rules'
import { useCancelSettlement, useConfirmSettlement, useRejectSettlement } from '@/features/settlements/queries'
import { errorMessage } from '@/lib/api/errorMessage'
import { formatDateTime } from '@/lib/format'
import type { SettlementResponse } from '@/types/api'
import { Money } from './Money'
import { SettlementStatusBadge } from './SettlementStatusBadge'

interface SettlementCardProps {
  settlement: SettlementResponse
  groupId: string
  /** the person looking: "You" is shown instead of their name */
  me: string | undefined
  nameOf: (userId: string, fallback: string) => string
  groupActive: boolean
  /** the history only reports: the buttons live in the "waiting" section */
  showActions: boolean
}

export function SettlementCard({ settlement, groupId, me, nameOf, groupActive, showActions }: SettlementCardProps) {
  const { t, i18n } = useTranslation()
  const confirm = useConfirmSettlement(groupId)
  const reject = useRejectSettlement(groupId)
  const cancel = useCancelSettlement(groupId)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const actions = showActions ? actionsFor(settlement, me, groupActive) : []
  const failure = confirm.error ?? reject.error ?? cancel.error
  const who = (id: string, username: string) => (id === me ? t('settlements.you') : nameOf(id, username))

  return (
    <li className="space-y-3 rounded-2xl bg-white p-5 shadow-xs ring-1 ring-slate-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-slate-900">
            {who(settlement.fromUserId, settlement.fromUsername)} <span aria-hidden="true">→</span>
            <span className="sr-only"> {t('settlements.to')} </span> {who(settlement.toUserId, settlement.toUsername)}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">{formatDateTime(settlement.createdAt, i18n.resolvedLanguage ?? 'en')}</p>
        </div>
        <div className="text-end">
          <p className="text-lg font-semibold text-slate-900">
            <Money minor={settlement.amountMinor} currency={settlement.currency} />
          </p>
          <SettlementStatusBadge status={settlement.status} />
        </div>
      </div>

      {settlement.note && <p className="text-sm text-slate-700">“{settlement.note}”</p>}
      {settlement.status === 'REJECTED' && settlement.rejectionReason && (
        <p className="text-sm text-slate-600">{t('settlements.reason')}: {settlement.rejectionReason}</p>
      )}

      {failure != null ? <Alert variant="error">{errorMessage(t, failure)}</Alert> : null}

      {actions.length > 0 && !rejecting && (
        <div className="flex flex-wrap gap-3">
          {actions.includes('confirm') && (
            <Button loading={confirm.isPending} onClick={() => confirm.mutate(settlement.id)}>
              {t('settlements.confirm')}
            </Button>
          )}
          {actions.includes('reject') && (
            <Button variant="secondary" onClick={() => setRejecting(true)}>
              {t('settlements.reject')}
            </Button>
          )}
          {actions.includes('cancel') && (
            <Button variant="secondary" loading={cancel.isPending} onClick={() => cancel.mutate(settlement.id)}>
              {t('settlements.cancel')}
            </Button>
          )}
        </div>
      )}

      {rejecting && (
        <div role="group" aria-label={t('settlements.reject')} className="space-y-3 rounded-xl bg-slate-50 p-4">
          <TextField label={t('settlements.reasonLabel')} maxLength={200} value={reason} onChange={(event) => setReason(event.target.value)} />
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => { setRejecting(false); setReason('') }}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={reject.isPending}
              onClick={() => reject.mutate({ id: settlement.id, reason: reason.trim() || undefined })}
            >
              {t('settlements.confirmReject')}
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}
