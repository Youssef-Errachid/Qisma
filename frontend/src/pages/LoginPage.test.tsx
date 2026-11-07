import { screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { tokenStore } from '@/lib/api/tokenStore'
import { API, groupsAre, problem, session } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'

/** Nobody is signed in: the refresh at start-up is refused. */
function stranger() {
  server.use(http.post(`${API}/auth/refresh`, () => problem(401, 'INVALID_REFRESH_TOKEN')))
}

describe('LoginPage', () => {
  it('shows the form to a stranger', async () => {
    stranger()
    renderApp('/login')

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('validates before calling the server', async () => {
    stranger()
    let calls = 0
    server.use(http.post(`${API}/auth/login`, () => {
      calls++
      return HttpResponse.json(session())
    }))
    const { user } = renderApp('/login')

    await user.click(await screen.findByRole('button', { name: 'Sign in' }))

    expect(await screen.findAllByText('This field is required')).toHaveLength(2)
    expect(calls).toBe(0)
  })

  it('signs in, keeps the token in memory only, and lands on the groups list', async () => {
    stranger()
    groupsAre([])
    let body: unknown = null
    server.use(http.post(`${API}/auth/login`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(session('token-xyz'))
    }))
    const { user } = renderApp('/login')

    await user.type(await screen.findByLabelText('Email'), 'youssef@test.com')
    await user.type(screen.getByLabelText('Password'), 'NewPassw0rd')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Your groups' })).toBeInTheDocument()
    expect(body).toEqual({ email: 'youssef@test.com', password: 'NewPassw0rd' })
    expect(tokenStore.get()).toBe('token-xyz')
    expect(JSON.stringify({ ...localStorage })).not.toContain('token-xyz')
  })

  it('says so, in the chosen language, when the credentials are wrong', async () => {
    stranger()
    server.use(http.post(`${API}/auth/login`, () => problem(401, 'INVALID_CREDENTIALS')))
    const { user } = renderApp('/login')

    await user.type(await screen.findByLabelText('Email'), 'youssef@test.com')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.')
    expect(tokenStore.get()).toBeNull()
  })

  it('explains a locked account, a throttled login and an unreachable server', async () => {
    stranger()
    const outcomes: Array<[() => Response, string]> = [
      [() => problem(423, 'ACCOUNT_LOCKED'), 'locked for a few minutes'],
      [() => problem(429, 'TOO_MANY_ATTEMPTS'), 'Too many attempts'],
      [() => HttpResponse.error(), 'Cannot reach the server'],
    ]
    for (const [answer, expected] of outcomes) {
      server.use(http.post(`${API}/auth/login`, answer))
      const { user, unmount } = renderApp('/login')

      await user.type(await screen.findByLabelText('Email'), 'a@b.co')
      await user.type(screen.getByLabelText('Password'), 'x')
      await user.click(screen.getByRole('button', { name: 'Sign in' }))

      expect(await screen.findByRole('alert')).toHaveTextContent(expected)
      unmount()
    }
  })

  it('blocks a second click while the request is running', async () => {
    stranger()
    groupsAre([])
    let calls = 0
    server.use(http.post(`${API}/auth/login`, async () => {
      calls++
      await new Promise((resolve) => setTimeout(resolve, 80))
      return HttpResponse.json(session())
    }))
    const { user } = renderApp('/login')

    await user.type(await screen.findByLabelText('Email'), 'a@b.co')
    await user.type(screen.getByLabelText('Password'), 'x')
    const button = screen.getByRole('button', { name: 'Sign in' })
    await user.click(button)
    await user.click(button)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Your groups' })).toBeInTheDocument())
    expect(calls).toBe(1)
  })

  it('speaks French when asked to', async () => {
    stranger()
    const { user } = renderApp('/login')

    await user.selectOptions(await screen.findByLabelText('Language'), 'fr')

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('fr')
  })
})
