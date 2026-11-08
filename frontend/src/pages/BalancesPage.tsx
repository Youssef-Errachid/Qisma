import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Money } from '@/components/shared/Money'
import { QueryBoundary } from '@/components/shared/QueryBoundary'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/useAuth'
import { useBalances } from '@/features/balances/queries'
import { useGroupContext } from '@/features/groups/useGroupContext'
import { positionOf, sortBalances } from '@/features/settlements/rules'
import { usePendingSettlements, useSuggestions } from '@/features/settlements/queries'
import type { BalancesResponse, MemberBalance } from '@/types/api'

function MyPosition({ me, currency }: { me: MemberBalance; currency: string }) {
  const { t } = useTranslation()
  const position = positionOf(me)
  const waiting = me.pendingOutMinor !== 0 || me.pendingInMinor !== 0
  const after = positionOf({ netMinor: me.effectiveNetMinor })
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{t('balances.yourPosition')}</p>
      {position.kind === 'settled' ? (
        <p className="mt-1 text-2xl font-semibold text-slate-700">{t('balances.settledUp')}</p>
      ) : (
        <p className={`mt-1 text-2xl font-semibold ${position.kind === 'receive' ? 'text-credit' : 'text-debt'}`}>
          {t(position.kind === 'receive' ? 'balances.youShouldReceive' : 'balances.youOwe')}{' '}
          <Money minor={position.amountMinor} currency={currency} />
        </p>
      )}
      {waiting && (
        <p className="mt-2 text-sm text-slate-600">
          {t('balances.afterPending')}:{' '}
          {after.kind === 'settled' ? t('balances.settledUp') : (
            <>
              {t(after.kind === 'receive' ? 'balances.youShouldReceive' : 'balances.youOwe')} <Money minor={after.amountMinor} currency={currency} />
            </>
          )}
        </p>
      )}
    </div>
  )
}

function BalancesTable({ balances, meId }: { balances: BalancesResponse; meId: string | undefined }) {
  const { t } = useTranslation()
  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <table className="w-full text-sm">
        <caption className="sr-only">{t('balances.tableTitle')}</caption>
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-3 text-start font-medium">{t('balances.member')}</th>
            <th scope="col" className="px-4 py-3 text-end font-medium">{t('balances.paid')}</th>
            <th scope="col" className="px-4 py-3 text-end font-medium">{t('balances.share')}</th>
            <th scope="col" className="px-4 py-3 text-end font-medium">{t('balances.balance')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sortBalances(balances.members).map((m) => (
            <tr key={m.userId}>
              <th scope="row" className="px-4 py-3 text-start font-medium text-slate-900">
                <span>{m.fullName || m.username}</span>
                {m.userId === meId && <span className="ms-2"><Badge tone="brand">{t('settlements.you')}</Badge></span>}
                {m.membershipStatus === 'INACTIVE' && <span className="ms-2"><Badge>{t('balances.left')}</Badge></span>}
                {(m.pendingOutMinor > 0 || m.pendingInMinor > 0) && (
                  <span className="mt-0.5 block text-xs font-normal text-slate-500">
                    {m.pendingOutMinor > 0 && <>{t('balances.pendingOut')}: <Money minor={m.pendingOutMinor} currency={balances.currency} /> </>}
                    {m.pendingInMinor > 0 && <>{t('balances.pendingIn')}: <Money minor={m.pendingInMinor} currency={balances.currency} /></>}
                  </span>
                )}
              </th>
              <td className="px-4 py-3 text-end text-slate-600"><Money minor={m.paidMinor} currency={balances.currency} /></td>
              <td className="px-4 py-3 text-end text-slate-600"><Money minor={m.shareMinor} currency={balances.currency} /></td>
              <td className="px-4 py-3 text-end font-semibold"><Money minor={m.netMinor} currency={balances.currency} tone="balance" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function BalancesPage() {
  const { t } = useTranslation()
  const group = useGroupContext()
  const { user } = useAuth()
  const balances = useBalances(group.id)
  const suggestions = useSuggestions(group.id)
  const pending = usePendingSettlements(group.id)

  // the suggestions name people by username; everywhere else they have their full name, so use it here too
  const fullNames = new Map((balances.data?.members ?? []).map((m) => [m.userId, m.fullName || m.username]))
  const nameOf = (id: string, username: string) => fullNames.get(id) ?? username

  const waitingForMe = pending.data?.items.filter((s) => s.toUserId === user?.id).length ?? 0
  const base = `/groups/${encodeURIComponent(group.id)}/settlements`

  return (
    <section className="space-y-6 pt-6">
      {waitingForMe > 0 && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 px-5 py-4 ring-1 ring-inset ring-amber-200">
          <p className="text-sm font-medium text-amber-800">{t('balances.waitingForYou', { count: waitingForMe })}</p>
          <Link to={base} className="text-sm font-semibold text-amber-900 underline">{t('balances.review')}</Link>
        </div>
      )}

      <QueryBoundary query={balances}>
        {(data) => {
          const me = data.members.find((m) => m.userId === user?.id)
          return (
            <>
              {data.sumMinor !== 0 && <Alert variant="error">{t('balances.unbalanced')}</Alert>}
              {me && <MyPosition me={me} currency={data.currency} />}
              <BalancesTable balances={data} meId={user?.id} />
            </>
          )
        }}
      </QueryBoundary>

      <section aria-labelledby="suggestions-title" className="space-y-3">
        <h2 id="suggestions-title" className="text-lg font-semibold">{t('balances.howToSettle')}</h2>
        <QueryBoundary query={suggestions}>
          {(data) =>
            data.transfers.length === 0 ? (
              <p className="rounded-2xl bg-white p-5 text-sm text-slate-600 shadow-xs ring-1 ring-slate-200">
                {/* settled means nothing is owed; repayments that are waiting can also leave nothing to suggest while money is still owed */}
                {balances.data && balances.data.members.every((m) => m.netMinor === 0) ? t('balances.nothingToSettle') : t('balances.nothingToSuggest')}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                {data.transfers.map((transfer) => {
                  const mine = transfer.fromUserId === user?.id
                  const forMe = transfer.toUserId === user?.id
                  return (
                    <li key={`${transfer.fromUserId}-${transfer.toUserId}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                      <p className="text-sm text-slate-800">
                        <span className="font-medium">{mine ? t('settlements.you') : nameOf(transfer.fromUserId, transfer.fromUsername)}</span> <span aria-hidden="true">→</span>
                        <span className="sr-only"> {t('settlements.to')} </span>{' '}
                        <span className="font-medium">{forMe ? t('settlements.you') : nameOf(transfer.toUserId, transfer.toUsername)}</span>
                        {': '}<Money minor={transfer.amountMinor} currency={data.currency} className="font-semibold" />
                      </p>
                      {mine && group.status === 'ACTIVE' && (
                        <Link to={`${base}/new?to=${encodeURIComponent(transfer.toUserId)}&amount=${transfer.amountMinor}`}>
                          <Button>{t('balances.payNow')}</Button>
                        </Link>
                      )}
                      {forMe && <span className="text-sm text-slate-500">{t('balances.waitingForThem')}</span>}
                    </li>
                  )
                })}
              </ul>
            )
          }
        </QueryBoundary>
      </section>
    </section>
  )
}
