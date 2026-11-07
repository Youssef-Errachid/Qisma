import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/StateViews'
import { TextField } from '@/components/ui/TextField'
import { groupKeys } from '@/features/groups/queries'
import { acceptInvitation, previewInvitation } from '@/features/invitations/invitationService'
import { formatCodeInput, parseInvitationInput } from '@/features/invitations/code'
import { errorMessage } from '@/lib/api/errorMessage'
import { currencyName, formatDate } from '@/lib/format'

/** /join (type a code, or paste a link) and /join/:secret (a link opened directly). */
export function JoinGroupPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { secret: linkSecret } = useParams<{ secret: string }>()
  const language = i18n.resolvedLanguage ?? 'en'

  const [typed, setTyped] = useState('')
  const [submitted, setSubmitted] = useState<string | null>(null)
  const [formatError, setFormatError] = useState(false)

  const secret = linkSecret ? parseInvitationInput(linkSecret) ?? linkSecret : submitted

  // a wrong code counts against the server's attempt limit, so a failure is never retried by itself
  const preview = useQuery({
    queryKey: ['invitation', secret],
    queryFn: () => previewInvitation(secret as string),
    enabled: secret !== null,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })

  const accept = useMutation({
    mutationFn: () => acceptInvitation(secret as string),
    onSuccess: (group) => {
      queryClient.setQueryData(groupKeys.detail(group.id), group)
      void queryClient.invalidateQueries({ queryKey: groupKeys.list() })
      navigate(`/groups/${encodeURIComponent(group.id)}`, { replace: true })
    },
  })

  function lookUp(event: { preventDefault: () => void }) {
    event.preventDefault()
    const parsed = parseInvitationInput(typed)
    setFormatError(parsed === null)
    setSubmitted(parsed)
    if (parsed !== null && parsed === submitted && preview.isError) {
      void preview.refetch() // the same code again: the state does not change, so ask explicitly
    }
  }

  function chooseAnotherCode() {
    setSubmitted(null)
    setTyped('')
    accept.reset()
    if (linkSecret) {
      navigate('/join', { replace: true })
    }
  }

  const showForm = !linkSecret && (secret === null || preview.isError)

  return (
    <section className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('join.title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('join.subtitle')}</p>
      </div>

      {secret !== null && preview.isPending && <LoadingState />}

      {preview.isError && (
        <div className="space-y-3">
          <Alert variant="error">{errorMessage(t, preview.error)}</Alert>
          {linkSecret && (
            <Button variant="secondary" onClick={chooseAnotherCode}>
              {t('join.useCode')}
            </Button>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={lookUp} noValidate className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <TextField
            label={t('join.codeLabel')}
            hint={t('join.codeHint')}
            placeholder="ABCD-EFGH"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            dir="ltr"
            value={typed}
            onChange={(event) => {
              setTyped(formatCodeInput(event.target.value))
              setFormatError(false)
            }}
            error={formatError ? t('join.codeFormat') : undefined}
          />
          <Button type="submit" className="w-full">
            {t('join.check')}
          </Button>
        </form>
      )}

      {preview.isSuccess && (
        <div className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          {accept.isError && <Alert variant="error">{errorMessage(t, accept.error)}</Alert>}
          <div>
            <p className="text-sm text-slate-500">{t('join.invitedTo')}</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">{preview.data.groupName}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t('join.currency')}: {preview.data.currency} — {currencyName(preview.data.currency, language)}
            </p>
            {preview.data.expiresAt && (
              <p className="mt-1 text-xs text-slate-500">
                {t('join.expires', { date: formatDate(preview.data.expiresAt, language) })}
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={chooseAnotherCode}>
              {t('join.useCode')}
            </Button>
            <Button loading={accept.isPending} onClick={() => accept.mutate()}>
              {t('join.accept')}
            </Button>
          </div>
        </div>
      )}

      <p className="text-center text-sm">
        <Link to="/groups" className="font-medium text-brand hover:underline">
          {t('join.back')}
        </Link>
      </p>
    </section>
  )
}
