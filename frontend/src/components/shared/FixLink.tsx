import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/lib/api/errors'

/** Where to go to fix what a refusal is about: a balance that is not zero, or a repayment still waiting. */
export function FixLink({ error, groupId }: { error: unknown; groupId: string }) {
  const { t } = useTranslation()
  if (!(error instanceof ApiError)) return null
  const base = `/groups/${encodeURIComponent(groupId)}`
  if (error.code === 'BALANCE_NOT_SETTLED') return <Link to={`${base}/balances`} className="text-sm font-medium text-brand underline">{t('members.seeBalances')}</Link>
  if (error.code === 'PENDING_SETTLEMENTS') return <Link to={`${base}/settlements`} className="text-sm font-medium text-brand underline">{t('members.seeRepayments')}</Link>
  return null
}
