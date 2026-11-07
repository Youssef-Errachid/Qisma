import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ConfirmPanel } from '@/components/shared/ConfirmPanel'
import { FixLink } from '@/components/shared/FixLink'
import { InvitationsSection } from '@/components/shared/InvitationsSection'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LoadingState, QueryErrorState } from '@/components/ui/StateViews'
import { useAuth } from '@/features/auth/useAuth'
import { useGroupContext } from '@/features/groups/useGroupContext'
import { useDeactivateMember, useLeaveGroup, useTransferOwnership } from '@/features/members/lifecycleQueries'
import { useMembers } from '@/features/members/queries'
import { errorMessage } from '@/lib/api/errorMessage'
import { formatDate } from '@/lib/format'
import type { MemberResponse } from '@/types/api'

type Pending = { userId: string; kind: 'remove' | 'owner' } | { userId: null; kind: 'leave' } | null

export function MembersPage() {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? 'en'
  const group = useGroupContext()
  const { user } = useAuth()
  const navigate = useNavigate()
  const members = useMembers(group.id)
  const deactivate = useDeactivateMember(group.id)
  const transfer = useTransferOwnership(group.id)
  const leave = useLeaveGroup(group.id)
  const [pending, setPending] = useState<Pending>(null)

  const groupActive = group.status === 'ACTIVE'
  const isOwner = group.myRole === 'OWNER' && groupActive

  if (members.isPending) return <LoadingState />
  if (members.isError) return <QueryErrorState error={members.error} onRetry={() => void members.refetch()} />

  const me = members.data.find((m) => m.userId === user?.id)
  const meActive = me?.status === 'ACTIVE'
  const onlyMember = members.data.filter((m) => m.status === 'ACTIVE').length === 1
  const close = () => { setPending(null); deactivate.reset(); transfer.reset(); leave.reset() }
  const nameOf = (m: MemberResponse) => m.fullName || m.username

  return (
    <section className="space-y-8 pt-6">
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        {members.data.map((member) => {
          const canManage = isOwner && member.userId !== user?.id && member.status === 'ACTIVE' && member.role === 'MEMBER'
          const open = pending && pending.userId === member.userId ? pending : null
          return (
            <li key={member.userId} className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                    <span className="truncate">{nameOf(member)}</span>
                    {member.userId === user?.id && <Badge tone="brand">{t('settlements.you')}</Badge>}
                    <Badge tone={member.role === 'OWNER' ? 'brand' : 'neutral'}>{t(`groups.role.${member.role}`)}</Badge>
                    {member.status === 'INACTIVE' && <Badge tone="warning">{t('balances.left')}</Badge>}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">@{member.username} · {t('members.joined', { date: formatDate(member.joinedAt, language) })}</p>
                </div>
                {canManage && !open && (
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setPending({ userId: member.userId, kind: 'owner' })}>{t('members.makeOwner')}</Button>
                    <Button variant="secondary" onClick={() => setPending({ userId: member.userId, kind: 'remove' })}>{t('members.remove')}</Button>
                  </div>
                )}
              </div>

              {open?.kind === 'remove' && (
                <>
                  <ConfirmPanel
                    title={t('members.removeTitle', { name: nameOf(member) })}
                    confirmLabel={t('members.removeConfirm')}
                    pending={deactivate.isPending}
                    error={deactivate.isError ? errorMessage(t, deactivate.error) : undefined}
                    onCancel={close}
                    onConfirm={() => deactivate.mutate(member.userId, { onSuccess: close })}
                  >
                    {t('members.removeBody')}
                  </ConfirmPanel>
                  <FixLink error={deactivate.error} groupId={group.id} />
                </>
              )}
              {open?.kind === 'owner' && (
                <ConfirmPanel
                  title={t('members.ownerTitle', { name: nameOf(member) })}
                  confirmLabel={t('members.ownerConfirm')}
                  pending={transfer.isPending}
                  error={transfer.isError ? errorMessage(t, transfer.error) : undefined}
                  onCancel={close}
                  onConfirm={() => transfer.mutate(member.userId, { onSuccess: close })}
                >
                  {t('members.ownerBody')}
                </ConfirmPanel>
              )}
            </li>
          )
        })}
      </ul>

      {isOwner && <InvitationsSection groupId={group.id} />}

      {groupActive && meActive && (
        <section aria-labelledby="leave-title" className="space-y-3">
          <h2 id="leave-title" className="text-lg font-semibold">{t('members.leaveTitle')}</h2>
          {isOwner && onlyMember ? (
            // nobody to hand the group to: leaving is not the way out, closing the group is
            <p className="text-sm text-slate-600">
              {t('members.onlyMember')}{' '}
              <Link to={`/groups/${encodeURIComponent(group.id)}/settings`} className="font-medium text-brand underline">{t('members.goToSettings')}</Link>
            </p>
          ) : isOwner ? (
            <p className="text-sm text-slate-600">{t('members.ownerCannotLeave')}</p>
          ) : pending?.kind === 'leave' ? (
            <>
              <ConfirmPanel
                title={t('members.leaveConfirmTitle')}
                confirmLabel={t('members.leaveConfirm')}
                pending={leave.isPending}
                error={leave.isError ? errorMessage(t, leave.error) : undefined}
                onCancel={close}
                onConfirm={() => leave.mutate(undefined, { onSuccess: () => navigate('/groups', { replace: true }) })}
              >
                {t('members.leaveBody')}
              </ConfirmPanel>
              <FixLink error={leave.error} groupId={group.id} />
            </>
          ) : (
            <Button variant="secondary" onClick={() => setPending({ userId: null, kind: 'leave' })}>{t('members.leave')}</Button>
          )}
        </section>
      )}
    </section>
  )
}
