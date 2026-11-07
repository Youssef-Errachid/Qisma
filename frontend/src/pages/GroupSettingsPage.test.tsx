import { screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, asSignedIn, group, groupIs, groupsAre, invitationsAre, membersAre, problem } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'

type Body = Record<string, unknown>

function setUp(groupOverrides = {}) {
  asSignedIn()
  groupIs(group({ id: 'g1', name: 'House 2026', description: 'Shared flat', currency: 'MAD', ...groupOverrides }))
  membersAre('g1')
  invitationsAre('g1', [])
  groupsAre([])
  const sent: { body: Body | null; calls: number } = { body: null, calls: 0 }
  server.use(http.put(`${API}/groups/g1`, async ({ request }) => {
    sent.calls++
    sent.body = (await request.json()) as Body
    return HttpResponse.json(group({ id: 'g1', ...(groupOverrides as object), name: String(sent.body.name), description: String(sent.body.description ?? ''), currency: String(sent.body.currency ?? 'MAD') }))
  }))
  return sent
}

describe('GroupSettingsPage: the settings', () => {
  it('starts from the group as it is', async () => {
    setUp()
    renderApp('/groups/g1/settings')

    expect(await screen.findByLabelText('Group name')).toHaveValue('House 2026')
    expect(screen.getByLabelText('Description (optional)')).toHaveValue('Shared flat')
    expect(screen.getByLabelText('Currency')).toHaveValue('MAD')
  })

  it('saves a new name and description, does not send the currency it did not change, and shows the new name', async () => {
    const sent = setUp()
    const { user } = renderApp('/groups/g1/settings')
    await user.clear(await screen.findByLabelText('Group name'))
    await user.type(screen.getByLabelText('Group name'), '  Flat 12  ')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('The changes were saved.')).toBeInTheDocument()
    expect(sent.body).toEqual({ name: 'Flat 12', description: 'Shared flat' })
    expect(await screen.findByRole('heading', { name: 'Flat 12', level: 1 })).toBeInTheDocument()
  })

  it('sends the currency when it was changed', async () => {
    const sent = setUp()
    const { user } = renderApp('/groups/g1/settings')

    await user.selectOptions(await screen.findByLabelText('Currency'), 'EUR')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await screen.findByText('The changes were saved.')
    expect(sent.body).toMatchObject({ currency: 'EUR' })
  })

  it('explains that the currency is fixed once the group has money in it', async () => {
    setUp()
    server.use(http.put(`${API}/groups/g1`, () => problem(409, 'CURRENCY_LOCKED')))
    const { user } = renderApp('/groups/g1/settings')

    await user.selectOptions(await screen.findByLabelText('Currency'), 'USD')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The currency cannot change once the group has expenses.')
    expect(screen.queryByText('The changes were saved.')).not.toBeInTheDocument()
  })

  it('shows a currency outside the menu as it is, and does not change it', async () => {
    const sent = setUp({ currency: 'JPY' })
    const { user } = renderApp('/groups/g1/settings')

    expect(await screen.findByLabelText('Currency')).toHaveValue('JPY')
    await user.type(screen.getByLabelText('Group name'), ' II')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await screen.findByText('The changes were saved.')
    expect(sent.body).not.toHaveProperty('currency')
  })

  it('needs a name, and not a name that is too long, before it calls the server', async () => {
    const sent = setUp()
    const { user } = renderApp('/groups/g1/settings')
    await user.clear(await screen.findByLabelText('Group name'))

    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('This field is required')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Group name'), 'x'.repeat(81))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('This is too long')).toBeInTheDocument()
    expect(sent.calls).toBe(0)
  })

  it('shows a server field error on its field', async () => {
    setUp()
    server.use(http.put(`${API}/groups/g1`, () => problem(400, 'VALIDATION_FAILED', 'Validation failed', [{ field: 'name', message: 'already used' }])))
    const { user } = renderApp('/groups/g1/settings')

    await user.click(await screen.findByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('already used')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('GroupSettingsPage: who sees it', () => {
  it('has a Settings tab for the owner only', async () => {
    setUp({ myRole: 'OWNER' })
    const owner = renderApp('/groups/g1')
    expect(within(await screen.findByRole('navigation', { name: 'Group sections' })).getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    owner.unmount()

    setUp({ myRole: 'MEMBER' })
    renderApp('/groups/g1')
    expect(within(await screen.findByRole('navigation', { name: 'Group sections' })).queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('says so to a member who opens the address anyway, and shows no form', async () => {
    setUp({ myRole: 'MEMBER' })
    renderApp('/groups/g1/settings')

    expect(await screen.findByText('Only the owner of the group can change its settings.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Group name')).not.toBeInTheDocument()
  })

  it('says an archived group can no longer be changed', async () => {
    setUp({ status: 'ARCHIVED' })
    renderApp('/groups/g1/settings')

    expect(await screen.findByText('This group is archived: its settings can no longer be changed.')).toBeInTheDocument()
  })
})

describe('GroupSettingsPage: archiving', () => {
  it('archives after a confirmation, and every screen of the group then shows it as archived', async () => {
    setUp()
    let archived = 0
    server.use(http.delete(`${API}/groups/g1`, () => {
      archived++
      groupIs(group({ id: 'g1', name: 'House 2026', status: 'ARCHIVED' }))   // read again from now on
      return new HttpResponse(null, { status: 204 })
    }))
    const { user } = renderApp('/groups/g1/settings')

    await user.click(await screen.findByRole('button', { name: 'Archive this group' }))
    expect(screen.getByText('Archive this group?')).toBeInTheDocument()
    expect(archived).toBe(0)
    await user.click(screen.getByRole('button', { name: 'Yes, archive it' }))

    expect(await screen.findByText('This group is archived: its settings can no longer be changed.')).toBeInTheDocument()
    expect(archived).toBe(1)
    expect(screen.getAllByText('Archived').length).toBeGreaterThan(0)
  })

  it('lets the owner change their mind', async () => {
    setUp()
    let archived = 0
    server.use(http.delete(`${API}/groups/g1`, () => { archived++; return new HttpResponse(null, { status: 204 }) }))
    const { user } = renderApp('/groups/g1/settings')

    await user.click(await screen.findByRole('button', { name: 'Archive this group' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Archive this group?')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archive this group' })).toBeInTheDocument()
    expect(archived).toBe(0)
  })

  it('refuses while a repayment is waiting, says so, and links to it', async () => {
    setUp()
    server.use(http.delete(`${API}/groups/g1`, () => problem(409, 'PENDING_SETTLEMENTS')))
    const { user } = renderApp('/groups/g1/settings')

    await user.click(await screen.findByRole('button', { name: 'Archive this group' }))
    await user.click(screen.getByRole('button', { name: 'Yes, archive it' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A repayment is still waiting for a decision.')
    expect(screen.getByRole('link', { name: 'See the repayments' })).toHaveAttribute('href', '/groups/g1/settlements')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Yes, archive it' })).toBeEnabled())
  })
})
