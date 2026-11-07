import { screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, asSignedIn, group, groupIs, groupsAre, problem } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'

const PREVIEW = { groupName: 'Trip to Essaouira', currency: 'EUR', type: 'CODE', expiresAt: '2026-11-20T00:00:00Z' }
const JOINED = group({ id: 'g9', name: 'Trip to Essaouira', currency: 'EUR', myRole: 'MEMBER' })

function invitationIs(secret: string, preview: object = PREVIEW) {
  server.use(http.get(`${API}/invitations/${secret}`, () => HttpResponse.json(preview)))
}

function acceptWorks(secret: string, record: { calls: number } = { calls: 0 }) {
  server.use(http.post(`${API}/invitations/${secret}/accept`, () => {
    record.calls++
    return HttpResponse.json(JOINED)
  }))
  groupIs(JOINED)
  groupsAre([JOINED])
  return record
}

describe('JoinGroupPage with a typed code', () => {
  it('shows the code the way it is spelled, checks it, and joins on confirmation', async () => {
    asSignedIn()
    invitationIs('ABCDEFGH')
    const accepted = acceptWorks('ABCDEFGH')
    const { user, router } = renderApp('/join')

    const input = await screen.findByLabelText('Invitation code or link')
    await user.type(input, 'abcd efgh')
    expect(input).toHaveValue('ABCD-EFGH')
    await user.click(screen.getByRole('button', { name: 'Check invitation' }))

    expect(await screen.findByRole('heading', { name: 'Trip to Essaouira' })).toBeInTheDocument()
    expect(screen.getByText(/EUR — Euro/)).toBeInTheDocument()
    expect(screen.getByText('This invitation expires on 20 Nov 2026.')).toBeInTheDocument()
    expect(accepted.calls).toBe(0)

    await user.click(screen.getByRole('button', { name: 'Join this group' }))

    expect(await screen.findByRole('heading', { name: 'Trip to Essaouira', level: 1 })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/groups/g9')
    expect(accepted.calls).toBe(1)
  })

  it('refuses text that cannot be an invitation without asking the server (a wrong guess counts against the limit)', async () => {
    asSignedIn()
    const { user } = renderApp('/join')

    await user.type(await screen.findByLabelText('Invitation code or link'), 'zzz')
    await user.click(screen.getByRole('button', { name: 'Check invitation' }))

    expect(await screen.findByText('This does not look like an invitation code or link.')).toBeInTheDocument()
  })

  it('understands a whole invitation link pasted into the box', async () => {
    asSignedIn()
    invitationIs('ABCDEFGH')
    const { user } = renderApp('/join')

    await user.click(await screen.findByLabelText('Invitation code or link'))
    await user.paste('Join us: https://qisma.app/join/abcd-efgh')
    await user.click(screen.getByRole('button', { name: 'Check invitation' }))

    expect(await screen.findByRole('heading', { name: 'Trip to Essaouira' })).toBeInTheDocument()
  })

  it('says the invitation is no good, keeps the box, and does not retry by itself', async () => {
    asSignedIn()
    let calls = 0
    server.use(http.get(`${API}/invitations/ABCDEFGH`, () => {
      calls++
      return problem(404, 'INVITATION_INVALID')
    }))
    const { user } = renderApp('/join')

    await user.type(await screen.findByLabelText('Invitation code or link'), 'abcdefgh')
    await user.click(screen.getByRole('button', { name: 'Check invitation' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('invalid, expired or already used')
    expect(screen.getByLabelText('Invitation code or link')).toHaveValue('ABCD-EFGH')
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(calls).toBe(1)
  })

  it('asks the server again when the same code is checked a second time', async () => {
    asSignedIn()
    let calls = 0
    server.use(http.get(`${API}/invitations/ABCDEFGH`, () => {
      calls++
      return calls === 1 ? problem(404, 'INVITATION_INVALID') : HttpResponse.json(PREVIEW)
    }))
    const { user } = renderApp('/join')

    await user.type(await screen.findByLabelText('Invitation code or link'), 'abcdefgh')
    await user.click(screen.getByRole('button', { name: 'Check invitation' }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Check invitation' }))

    expect(await screen.findByRole('heading', { name: 'Trip to Essaouira' })).toBeInTheDocument()
    expect(calls).toBe(2)
  })

  it('tells the user to wait when too many wrong codes were tried', async () => {
    asSignedIn()
    server.use(http.get(`${API}/invitations/ABCDEFGH`, () => problem(429, 'TOO_MANY_ATTEMPTS')))
    const { user } = renderApp('/join')

    await user.type(await screen.findByLabelText('Invitation code or link'), 'abcdefgh')
    await user.click(screen.getByRole('button', { name: 'Check invitation' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts')
  })

  it('tells someone who is already in the group, and stays on the page', async () => {
    asSignedIn()
    invitationIs('ABCDEFGH')
    server.use(http.post(`${API}/invitations/ABCDEFGH/accept`, () => problem(409, 'ALREADY_MEMBER')))
    const { user, router } = renderApp('/join')

    await user.type(await screen.findByLabelText('Invitation code or link'), 'abcdefgh')
    await user.click(screen.getByRole('button', { name: 'Check invitation' }))
    await user.click(await screen.findByRole('button', { name: 'Join this group' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('already a member')
    expect(router.state.location.pathname).toBe('/join')
  })

  it('lets the user choose another code after a preview', async () => {
    asSignedIn()
    invitationIs('ABCDEFGH')
    const { user } = renderApp('/join')

    await user.type(await screen.findByLabelText('Invitation code or link'), 'abcdefgh')
    await user.click(screen.getByRole('button', { name: 'Check invitation' }))
    await user.click(await screen.findByRole('button', { name: 'Use another code' }))

    expect(await screen.findByLabelText('Invitation code or link')).toHaveValue('')
    expect(screen.queryByRole('heading', { name: 'Trip to Essaouira' })).not.toBeInTheDocument()
  })
})

describe('JoinGroupPage with an invitation link', () => {
  const SECRET = 'q3Vn_8xTkL2m-ZpR7sYwB1aCdEfGhJkLmNoPqRsTuVw'

  it('previews the invitation straight away and joins on confirmation', async () => {
    asSignedIn()
    invitationIs(SECRET, { ...PREVIEW, type: 'LINK', expiresAt: null })
    const accepted = acceptWorks(SECRET)
    const { user, router } = renderApp(`/join/${SECRET}`)

    expect(await screen.findByRole('heading', { name: 'Trip to Essaouira' })).toBeInTheDocument()
    expect(screen.queryByText(/expires on/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Invitation code or link')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Join this group' }))

    expect(await screen.findByRole('heading', { name: 'Trip to Essaouira', level: 1 })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/groups/g9')
    expect(accepted.calls).toBe(1)
  })

  it('never joins by itself: opening a link only shows what the group is', async () => {
    asSignedIn()
    invitationIs(SECRET)
    const accepted = acceptWorks(SECRET)
    renderApp(`/join/${SECRET}`)

    await screen.findByRole('heading', { name: 'Trip to Essaouira' })

    expect(accepted.calls).toBe(0)
  })

  it('shows an unusable link as such and offers to type a code instead', async () => {
    asSignedIn()
    server.use(http.get(`${API}/invitations/${SECRET}`, () => problem(404, 'INVITATION_INVALID')))
    const { user, router } = renderApp(`/join/${SECRET}`)

    expect(await screen.findByRole('alert')).toHaveTextContent('invalid, expired or already used')
    await user.click(screen.getByRole('button', { name: 'Use another code' }))

    expect(await screen.findByLabelText('Invitation code or link')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/join')
  })

  it('makes a stranger sign in first and then comes back to the invitation', async () => {
    server.use(http.post(`${API}/auth/refresh`, () => problem(401, 'INVALID_REFRESH_TOKEN')))
    const { router } = renderApp(`/join/${SECRET}`)

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect((router.state.location.state as { from: { pathname: string } }).from.pathname).toBe(`/join/${SECRET}`)
  })
})
