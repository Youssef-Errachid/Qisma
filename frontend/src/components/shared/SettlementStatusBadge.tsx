import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/Badge'
import type { SettlementStatus } from '@/types/api'

const TONE = { PENDING: 'warning', CONFIRMED: 'brand', REJECTED: 'neutral', CANCELLED: 'neutral' } as const

export function SettlementStatusBadge({ status }: { status: SettlementStatus }) {
  const { t } = useTranslation()
  return <Badge tone={TONE[status]}>{t(`settlements.status.${status}`)}</Badge>
}
