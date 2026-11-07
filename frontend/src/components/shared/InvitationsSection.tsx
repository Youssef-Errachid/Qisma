import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/SelectField'
import { LoadingState, QueryErrorState } from '@/components/ui/StateViews'
import { TextField } from '@/components/ui/TextField'
import { useCreateInvitation, useInvitations, useRevokeInvitation } from '@/features/invitations/adminQueries'
import { DEFAULT_EXPIRY_DAYS, DEFAULT_MAX_USES, EXPIRY_CHOICES, MAX_USES_LIMIT, copyText, invitationLink } from '@/features/invitations/link'
import { errorMessage } from '@/lib/api/errorMessage'
import { formatDate } from '@/lib/format'
import type { InvitationCreated, InvitationStatus, InvitationType } from '@/types/api'

const STATUS_TONE: Record<InvitationStatus, 'brand' | 'neutral' | 'warning'> = { PENDING: 'brand', ACCEPTED: 'neutral', EXPIRED: 'warning', REVOKED: 'neutral' }

function CreatedInvitation({ created }: { created: InvitationCreated }) {
  const { t } = useTranslation()
  const link = invitationLink(window.location.origin, created.secret)
  const [copied, setCopied] = useState<'code' | 'link' | 'failed' | null>(null)

  async function copy(what: 'code' | 'link', text: string) {
    setCopied((await copyText(text)) ? what : 'failed')
  }

  return (
    <div role="status" className="space-y-4 rounded-2xl bg-credit-soft p-5 ring-1 ring-inset ring-emerald-200">
      <p className="font-semibold text-credit">{t('invitations.created')}</p>
      <p className="text-sm text-slate-700">{t('invitations.shownOnce')}</p>

      <div className="space-y-1">
        <p className="text-xs font-medium text-slate-500">{created.type === 'CODE' ? t('invitations.code') : t('invitations.secret')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <code dir="ltr" className="break-all rounded-lg bg-white px-3 py-2 font-mono text-sm ring-1 ring-slate-200">{created.secret}</code>
          <Button variant="secondary" onClick={() => void copy('code', created.secret)}>{t('invitations.copy')}</Button>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-slate-500">{t('invitations.link')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <code dir="ltr" className="break-all rounded-lg bg-white px-3 py-2 font-mono text-xs ring-1 ring-slate-200">{link}</code>
          <Button variant="secondary" onClick={() => void copy('link', link)}>{t('invitations.copyLink')}</Button>
        </div>
      </div>
      {copied === 'code' && <p className="text-sm font-medium text-credit">{t('invitations.copied')}</p>}
      {copied === 'link' && <p className="text-sm font-medium text-credit">{t('invitations.linkCopied')}</p>}
      {copied === 'failed' && <p className="text-sm font-medium text-debt">{t('invitations.copyFailed')}</p>}
    </div>
  )
}

export function InvitationsSection({ groupId }: { groupId: string }) {
  const { t, i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? 'en'
  const invitations = useInvitations(groupId, true)
  const create = useCreateInvitation(groupId)
  const revoke = useRevokeInvitation(groupId)

  const [type, setType] = useState<InvitationType>('CODE')
  const [days, setDays] = useState<number>(DEFAULT_EXPIRY_DAYS)
  const [uses, setUses] = useState(String(DEFAULT_MAX_USES))
  const [usesError, setUsesError] = useState(false)
  const [created, setCreated] = useState<InvitationCreated | null>(null)

  function submit(event: { preventDefault: () => void }) {
    event.preventDefault()
    const maxUses = Number(uses)
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > MAX_USES_LIMIT) {
      setUsesError(true)
      return
    }
    setUsesError(false)
    create.mutate({ type, expiresInDays: days, maxUses }, { onSuccess: (result) => setCreated(result) })
  }

  return (
    <section aria-labelledby="invitations-title" className="space-y-4">
      <h2 id="invitations-title" className="text-lg font-semibold">{t('invitations.title')}</h2>

      <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        {create.isError && <Alert variant="error">{errorMessage(t, create.error)}</Alert>}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-800">{t('invitations.kind')}</legend>
          <div className="flex flex-wrap gap-3">
            {(['CODE', 'LINK'] as const).map((option) => (
              <label key={option} className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm ring-1 ring-inset ${type === option ? 'bg-credit-soft text-credit ring-emerald-300' : 'text-slate-700 ring-slate-300 hover:bg-slate-50'}`}>
                <input type="radio" name="invitationType" value={option} checked={type === option} onChange={() => setType(option)} className="accent-brand focus:ring-brand" />
                {t(`invitations.type.${option}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label={t('invitations.expires')} value={days} onChange={(event) => setDays(Number(event.target.value))}>
            {EXPIRY_CHOICES.map((choice) => (
              <option key={choice} value={choice}>{choice}</option>
            ))}
          </SelectField>
          <TextField
            label={t('invitations.maxUses')}
            inputMode="numeric"
            value={uses}
            onChange={(event) => setUses(event.target.value)}
            error={usesError ? t('invitations.maxUsesInvalid', { max: MAX_USES_LIMIT }) : undefined}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={create.isPending}>{t('invitations.create')}</Button>
        </div>
      </form>

      {created && <CreatedInvitation key={created.id} created={created} />}

      {invitations.isPending && <LoadingState />}
      {invitations.isError && <QueryErrorState error={invitations.error} onRetry={() => void invitations.refetch()} />}
      {revoke.isError && <Alert variant="error">{errorMessage(t, revoke.error)}</Alert>}
      {invitations.isSuccess && invitations.data.length === 0 && <p className="text-sm text-slate-500">{t('invitations.none')}</p>}
      {invitations.isSuccess && invitations.data.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          {invitations.data.map((invitation) => (
            <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="space-y-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                  {t(`invitations.type.${invitation.type}`)}
                  <Badge tone={STATUS_TONE[invitation.status]}>{t(`invitations.status.${invitation.status}`)}</Badge>
                </p>
                <p className="text-xs text-slate-500">
                  {t('invitations.used', { used: invitation.useCount, max: invitation.maxUses })} ·{' '}
                  {invitation.expiresAt ? t('invitations.expiresOn', { date: formatDate(invitation.expiresAt, language) }) : t('invitations.noExpiry')}
                </p>
              </div>
              {invitation.status === 'PENDING' && (
                <Button variant="secondary" loading={revoke.isPending && revoke.variables === invitation.id} onClick={() => revoke.mutate(invitation.id)}>
                  {t('invitations.revoke')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
