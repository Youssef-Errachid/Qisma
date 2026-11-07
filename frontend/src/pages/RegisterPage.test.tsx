import { screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, problem, youssef } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'

function stranger() {
  server.use(http.post(`${API}/auth/refresh`, () => problem(401, 'INVALID_REFRESH_TOKEN')))
}

async function fillForm(user: ReturnType<typeof renderApp>['user'], overrides: Partial<Record<string, string>> = {}) {
  const values = {
    'Full name': 'Youssef Errachid',
    Username: 'youssef',
    Email: 'youssef@test.com',
    Password: 'NewPassw0rd',
    'Confirm password': 'NewPassw0rd',
    ...overrides,
  }
  for (const [label, value] of Object.entries(values)) {
    await user.type(await screen.findByLabelText(label), value as string)
  }
}

describe('RegisterPage', () => {
  it('shows the rules next to the fields and checks them before calling the server', async () => {
    stranger()
    let calls = 0
    server.use(http.post(`${API}/auth/register`, () => {
      calls++
      return HttpResponse.json(youssef, { status: 201 })
    }))
    const { user } = renderApp('/register')

    await fillForm(user, { Username: 'bad name', Password: 'onlyletters', 'Confirm password': 'different1' })
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Only letters, digits, dot, underscore and dash')).toBeInTheDocument()
    expect(screen.getByText('Include at least one letter and one digit')).toBeInTheDocument()
    expect(screen.getByText('The passwords do not match')).toBeInTheDocument()
    expect(calls).toBe(0)
  })

  it('creates the account and sends the new user to sign in, with a confirmation', async () => {
    stranger()
    let body: Record<string, string> | null = null
    server.use(http.post(`${API}/auth/register`, async ({ request }) => {
      body = (await request.json()) as Record<string, string>
      return HttpResponse.json(youssef, { status: 201 })
    }))
    const { user } = renderApp('/register')

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Your account is ready')
    expect(body).toEqual({
      username: 'youssef', fullName: 'Youssef Errachid', email: 'youssef@test.com',
      password: 'NewPassw0rd', confirmPassword: 'NewPassw0rd',
    })
  })

  it('puts the "e-mail already used" answer on the e-mail field', async () => {
    stranger()
    server.use(http.post(`${API}/auth/register`, () => problem(409, 'EMAIL_ALREADY_USED')))
    const { user } = renderApp('/register')

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('An account with this email already exists.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('puts the "username taken" answer on the username field', async () => {
    stranger()
    server.use(http.post(`${API}/auth/register`, () => problem(409, 'USERNAME_ALREADY_USED')))
    const { user } = renderApp('/register')

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('This username is already taken.')).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows the server field errors it knows, and a general message for the rest', async () => {
    stranger()
    server.use(http.post(`${API}/auth/register`, () =>
      problem(400, 'VALIDATION_FAILED', 'Validation failed', [{ field: 'fullName', message: 'size must be at most 100' }])))
    const { user } = renderApp('/register')

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('size must be at most 100')).toBeInTheDocument()

    server.use(http.post(`${API}/auth/register`, () => HttpResponse.error()))
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server')
  })

  it('links to the sign-in page', async () => {
    stranger()
    const { user } = renderApp('/register')

    await user.click(await screen.findByRole('link', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
  })
})
