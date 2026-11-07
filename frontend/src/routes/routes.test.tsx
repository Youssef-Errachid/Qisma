import { screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { tokenStore } from '@/lib/api/tokenStore'
import { API, asSignedIn, asStranger, group, groupIs, groupsAre, problem, session } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'

const GROUPS_PAGE = { name: 'Your groups' }

describe('route guards', () => {
  it('sends a stranger who opens a private page to the sign-in page', async () => {
    asStranger()
    const { router } = renderApp('/groups')

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.queryByRole('heading', GROUPS_PAGE)).not.toBeInTheDocument()
  })

  it('shows a spinner, never the private page, while the session is being checked', async () => {
    groupsAre([])
    server.use(http.post(`${API}/auth/refresh`, async () => {
      await new Promise((resolve) => setTimeout(resolve, 60))
      return HttpResponse.json(session())
    }))
    renderApp('/groups')

    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
    expect(screen.queryByRole('heading', GROUPS_PAGE)).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', GROUPS_PAGE)).toBeInTheDocument()
  })

  it('restores the session after a page reload from the refresh cookie', async () => {
    asSignedIn()
    groupsAre([])
    renderApp('/groups')

    expect(await screen.findByRole('heading', GROUPS_PAGE)).toBeInTheDocument()
    expect(tokenStore.get()).toBe('t-restored')
  })

  it('opens the groups list from the root address', async () => {
    asSignedIn()
    groupsAre([])
    const { router } = renderApp('/')

    expect(await screen.findByRole('heading', GROUPS_PAGE)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/groups')
  })

  it('keeps a signed-in user away from the sign-in and sign-up pages', async () => {
    asSignedIn()
    groupsAre([])
    const { router } = renderApp('/login')

    expect(await screen.findByRole('heading', GROUPS_PAGE)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/groups')
  })

  it('sends a stranger back to the exact page they wanted once they have signed in', async () => {
    asStranger()
    groupIs(group({ id: 'g7', name: 'Trip to Essaouira' }))
    server.use(http.post(`${API}/auth/login`, () => HttpResponse.json(session())))
    const { user, router } = renderApp('/groups/g7?tab=members')

    await user.type(await screen.findByLabelText('Email'), 'youssef@test.com')
    await user.type(screen.getByLabelText('Password'), 'NewPassw0rd')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Trip to Essaouira' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/groups/g7')
    expect(router.state.location.search).toBe('?tab=members')
  })

  it('signs out: the page changes, the token is forgotten, the server is told', async () => {
    asSignedIn()
    groupsAre([])
    let loggedOut = false
    server.use(http.post(`${API}/auth/logout`, () => {
      loggedOut = true
      return new HttpResponse(null, { status: 204 })
    }))
    const { user } = renderApp('/groups')

    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(tokenStore.get()).toBeNull()
    expect(loggedOut).toBe(true)
  })

  it('forgets everything fetched for the previous user when signing out', async () => {
    asSignedIn()
    groupsAre([group({ name: 'Secret group of the first user' })])
    server.use(http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })))
    server.use(http.post(`${API}/auth/login`, () => HttpResponse.json(session('t2', { ...session().user, id: 'u2', fullName: 'Someone Else' }))))
    const { user } = renderApp('/groups')
    expect(await screen.findByText('Secret group of the first user')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByRole('heading', { name: 'Sign in' })
    groupsAre([])
    await user.type(screen.getByLabelText('Email'), 'other@test.com')
    await user.type(screen.getByLabelText('Password'), 'Passw0rdOK')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('No groups yet')).toBeInTheDocument()
    expect(screen.queryByText('Secret group of the first user')).not.toBeInTheDocument()
  })

  it('does NOT pretend to sign out when the server cannot be told (the refresh cookie would bring the session back)', async () => {
    asSignedIn()
    groupsAre([])
    server.use(http.post(`${API}/auth/logout`, () => HttpResponse.error()))
    const { user } = renderApp('/groups')

    await user.click(await screen.findByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('You are still signed in. Cannot reach the server')
    expect(screen.getByRole('heading', GROUPS_PAGE)).toBeInTheDocument()
    expect(tokenStore.get()).toBe('t-restored')
  })

  it('lets the user try again after a failed sign-out', async () => {
    asSignedIn()
    groupsAre([])
    server.use(http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })))
    server.use(http.post(`${API}/auth/logout`, () => HttpResponse.error(), { once: true })) // newest wins, then it is spent
    const { user } = renderApp('/groups')

    await user.click(await screen.findByRole('button', { name: 'Sign out' }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(tokenStore.get()).toBeNull()
  })

  it('shows a friendly page for an unknown address', async () => {
    asStranger()
    renderApp('/nowhere/at/all')

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})

describe('session start-up', () => {
  it('asks for a new session exactly ONCE even when React StrictMode mounts twice', async () => {
    let refreshes = 0
    groupsAre([])
    server.use(http.post(`${API}/auth/refresh`, async () => {
      refreshes++
      await new Promise((resolve) => setTimeout(resolve, 30))
      return HttpResponse.json(session())
    }))
    renderApp('/groups', { strict: true })

    expect(await screen.findByRole('heading', GROUPS_PAGE)).toBeInTheDocument()
    expect(refreshes).toBe(1)
  })

  it('treats an unreachable server at start-up as "not signed in" instead of hanging', async () => {
    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.error()))
    renderApp('/groups')

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('sends the user to sign in when a later request finds the session gone for good', async () => {
    asSignedIn()
    groupsAre([])
    const { router } = renderApp('/groups')
    await screen.findByRole('heading', GROUPS_PAGE)
    server.use(
      http.get(`${API}/groups/lost`, () => problem(401, 'UNAUTHORIZED')),
      http.post(`${API}/auth/refresh`, () => problem(401, 'INVALID_REFRESH_TOKEN')),
    )

    const { api } = await import('@/lib/api/client')
    await api.get('/groups/lost').catch(() => undefined)

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
  })
})
