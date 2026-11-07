import { useTranslation } from 'react-i18next'
import { localeFor } from '@/lib/format'
import { formatMoney } from '@/lib/money'

interface MoneyProps {
  /** Integer minor units. Negative means owed. */
  minor: number
  currency: string
  /**
   * 'balance': green when positive (to receive), red when negative (owed), neutral at zero.
   * 'credit' / 'debt': the colour of what the figure means, whatever its sign. 'plain': inherits.
   */
  tone?: 'plain' | 'balance' | 'credit' | 'debt'
  className?: string
}

export function Money({ minor, currency, tone = 'plain', className = '' }: MoneyProps) {
  const { i18n } = useTranslation()
  const colour =
    tone === 'credit' ? (minor > 0 ? 'text-credit' : '')
    : tone === 'debt' ? (minor > 0 ? 'text-debt' : '')
    : tone === 'balance' ? (minor > 0 ? 'text-credit' : minor < 0 ? 'text-debt' : 'text-slate-600')
    : ''
  // amounts are always read left-to-right, even inside an Arabic sentence
  return (
    <bdi dir="ltr" className={`tabular-nums ${colour} ${className}`}>
      {formatMoney(minor, currency, localeFor(i18n.resolvedLanguage ?? 'en'))}
    </bdi>
  )
}
