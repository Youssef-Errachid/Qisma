import { screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { tokenStore } from '@/lib/api/tokenStore'
import { API, asSignedIn, groupsAre, problem, session, youssef } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'

type Body = Record<string, unknown>

function setUp() {
  asSignedIn()
  groupsAre([])
  const sent: { profile: Body | null; password: Body | null; profileCalls: number; passwordCalls: number } = { profile: null, password: null, profileCalls: 0, passwordCalls: 0 }
  server.use(
    http.put(`${API}/users/me`, async ({ request }) => {
      sent.profileCalls++
      sent.profile = (await request.json()) as Body
      return HttpResponse.json({ ...youssef, fullName: String(sent.profile.fullName), preferredLanguage: sent.profile.preferredLanguage })
    }),
    http.put(`${API}/users/me/password`, async ({ request }) => {
      sent.passwordCalls++
      sent.password = (await request.json()) as Body
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return sent
}

describe('AccountPage: the profile', () => {
  it('shows who the account is, and starts from the current name and language', async () => {
    setUp()
    renderApp('/account')

    expect(await screen.findByLabelText('Full name')).toHaveValue('Youssef Errachid')
    expect(screen.getByText('@youssef')).toBeInTheDocument()
    expect(screen.getByText('youssef@test.com')).toBeInTheDocument()
    expect(screen.getByLabelText('Preferred language')).toHaveValue('EN')
  })

  it('saves the name, and the header shows it at once', async () => {
    const sent = setUp()
    const { user } = renderApp('/account')
    await user.clear(await screen.findByLabelText('Full name'))
    await user.type(screen.getByLabelText('Full name'), '  Youssef E.  ')

    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(await screen.findByText('Your profile was saved.')).toBeInTheDocument()
    expect(sent.profile).toEqual({ fullName: 'Youssef E.', preferredLanguage: 'EN' })
    expect(within(screen.getByRole('banner')).getByText('Youssef E.')).toBeInTheDocument()
  })

  it('choosing a language switches this device to it at once, and keeps it', async () => {
    const sent = setUp()
    const { user } = renderApp('/account')

    await user.selectOptions(await screen.findByLabelText('Preferred language'), 'Français')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(await screen.findByText('Votre profil a été enregistré.')).toBeInTheDocument()
    expect(sent.profile).toMatchObject({ preferredLanguage: 'FR' })
    expect(localStorage.getItem('qisma.lang')).toBe('fr')
  })

  it('asks for a name, and not one that is too long, before it calls the server', async () => {
    const sent = setUp()
    const { user } = renderApp('/account')
    await user.clear(await screen.findByLabelText('Full name'))

    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(await screen.findByText('This field is required')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Full name'), 'x'.repeat(101))
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(await screen.findByText('Use at most 100 characters')).toBeInTheDocument()
    expect(sent.profileCalls).toBe(0)
  })

  it('shows a server field error on its field', async () => {
    setUp()
    server.use(http.put(`${API}/users/me`, () => problem(400, 'VALIDATION_FAILED', 'Validation failed', [{ field: 'fullName', message: 'not allowed' }])))
    const { user } = renderApp('/account')

    await user.click(await screen.findByRole('button', { name: 'Save profile' }))

    expect(await screen.findByText('not allowed')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('is reached from the header', async () => {
    setUp()
    const { user, router } = renderApp('/groups')

    await user.click(await screen.findByRole('link', { name: 'My account' }))

    expect(await screen.findByRole('heading', { name: 'My account', level: 1 })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/account')
  })
})

describe('AccountPage: the password', () => {
  async function fill(user: ReturnType<typeof renderApp>['user'], current: string, next: string, confirm: string) {
    await user.type(await screen.findByLabelText('Current password'), current)
    await user.type(screen.getByLabelText('New password'), next)
    await user.type(screen.getByLabelText('Confirm the new password'), confirm)
    await user.click(screen.getByRole('button', { name: 'Change password' }))
  }

  it('changes it, then signs the person out here too, and says why on the sign-in page', async () => {
    const sent = setUp()
    const { user, router } = renderApp('/account')

    await fill(user, 'OldPassw0rd', 'NewPassw0rd', 'NewPassw0rd')

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByText(/Your password was changed/)).toBeInTheDocument()
    expect(sent.password).toEqual({ currentPassword: 'OldPassw0rd', newPassword: 'NewPassw0rd', confirmNewPassword: 'NewPassw0rd' })
    expect(tokenStore.get()).toBeNull()
    expect(router.state.location.pathname).toBe('/login')
  })

  it('does not call the server for a password that is too weak, that does not match, or that is the same', async () => {
    const sent = setUp()
    const { user } = renderApp('/account')

    await fill(user, 'OldPassw0rd', 'onlyletters', 'onlyletters')
    expect(await screen.findByText('Include at least one letter and one digit')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('New password'))
    await user.clear(screen.getByLabelText('Confirm the new password'))
    await user.type(screen.getByLabelText('New password'), 'NewPassw0rd')
    await user.type(screen.getByLabelText('Confirm the new password'), 'Different1')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByText('The passwords do not match')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('New password'))
    await user.clear(screen.getByLabelText('Confirm the new password'))
    await user.type(screen.getByLabelText('New password'), 'OldPassw0rd')
    await user.type(screen.getByLabelText('Confirm the new password'), 'OldPassw0rd')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByText('The new password must be different from the current one')).toBeInTheDocument()

    expect(sent.passwordCalls).toBe(0)
  })

  it('says the current password is wrong, and keeps the person signed in', async () => {
    setUp()
    server.use(http.put(`${API}/users/me/password`, () => problem(400, 'CURRENT_PASSWORD_INCORRECT')))
    const { user, router } = renderApp('/account')

    await fill(user, 'WrongPassw0rd', 'NewPassw0rd', 'NewPassw0rd')

    expect(await screen.findByRole('alert')).toHaveTextContent('The current password is incorrect.')
    expect(router.state.location.pathname).toBe('/account')
    expect(tokenStore.get()).not.toBeNull()
  })

  it('warns, before anything is typed, that the change signs the person out everywhere', async () => {
    setUp()
    renderApp('/account')

    expect(await screen.findByText(/signs you out everywhere, this device included/)).toBeInTheDocument()
  })
})

describe('the language of the account', () => {
  it('is applied when this device has not chosen one', async () => {
    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.json(session('t', { ...youssef, preferredLanguage: 'FR' }))))
    groupsAre([])
    localStorage.clear()
    renderApp('/groups')

    expect(await screen.findByRole('heading', { name: 'Vos groupes' })).toBeInTheDocument()
  })

  it('never wins over a language chosen on this device', async () => {
    server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.json(session('t', { ...youssef, preferredLanguage: 'FR' }))))
    groupsAre([])
    localStorage.setItem('qisma.lang', 'en')
    renderApp('/groups')

    expect(await screen.findByRole('heading', { name: 'Your groups' })).toBeInTheDocument()
  })
})
