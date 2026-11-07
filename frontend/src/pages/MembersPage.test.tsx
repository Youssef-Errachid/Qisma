import { screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { API, FRIENDS, asSignedIn, group, groupIs, groupsAre, invitation, invitationsAre, member, membersAre, problem } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'
import type { InvitationSummary, MemberResponse } from '@/types/api'

type Body = Record<string, unknown>

function setUp(groupOverrides = {}, members: MemberResponse[] = FRIENDS, invitations: InvitationSummary[] = []) {
  asSignedIn()
  groupIs(group({ id: 'g1', ...groupOverrides }))
  membersAre('g1', members)
  return invitationsAre('g1', invitations)
}

const rowOf = async (name: string) => (await screen.findByText(name)).closest('li') as HTMLElement

describe('MembersPage: the members', () => {
  it('lists everyone with their role, "You", and who left', async () => {
    setUp({}, [...FRIENDS, member({ userId: 'u-old', username: 'old', fullName: 'Old Friend', role: 'MEMBER', status: 'INACTIVE' })])
    renderApp('/groups/g1/members')

    const me = await rowOf('Youssef E.')
    expect(within(me).getByText('You')).toBeInTheDocument()
    expect(within(me).getByText('Owner')).toBeInTheDocument()
    expect(within(me).getByText(/@youssef · joined/)).toBeInTheDocument()
    expect(within(await rowOf('Ahmed B.')).getByText('Member')).toBeInTheDocument()
    expect(within(await rowOf('Old Friend')).getByText('Left the group')).toBeInTheDocument()
  })

  it('gives the owner buttons for ordinary active members only: not for themselves, not for someone who left', async () => {
    setUp({ myRole: 'OWNER' }, [...FRIENDS, member({ userId: 'u-old', username: 'old', fullName: 'Old Friend', role: 'MEMBER', status: 'INACTIVE' })])
    renderApp('/groups/g1/members')

    expect(within(await rowOf('Ahmed B.')).getByRole('button', { name: 'Make owner' })).toBeInTheDocument()
    expect(within(await rowOf('Ahmed B.')).getByRole('button', { name: 'Remove' })).toBeInTheDocument()
    expect(within(await rowOf('Youssef E.')).queryByRole('button')).not.toBeInTheDocument()
    expect(within(await rowOf('Old Friend')).queryByRole('button')).not.toBeInTheDocument()
  })

  it('gives an ordinary member no way to manage the others, and no invitations', async () => {
    setUp({ myRole: 'MEMBER' })
    renderApp('/groups/g1/members')

    await rowOf('Ahmed B.')

    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Make owner' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Invite people' })).not.toBeInTheDocument()
  })

  it('removes a member after a confirmation, who then shows as having left', async () => {
    const members = FRIENDS.map((m) => ({ ...m }))
    setUp({}, members)
    let removed = 0
    server.use(http.delete(`${API}/groups/g1/members/u-ahmed`, () => {
      removed++
      members[1] = { ...members[1], status: 'INACTIVE' }
      return new HttpResponse(null, { status: 204 })
    }))
    membersAre('g1', members)
    const { user } = renderApp('/groups/g1/members')

    await user.click(within(await rowOf('Ahmed B.')).getByRole('button', { name: 'Remove' }))
    expect(screen.getByText('Remove Ahmed B. from the group?')).toBeInTheDocument()
    expect(removed).toBe(0)
    await user.click(screen.getByRole('button', { name: 'Yes, remove' }))

    await waitFor(() => expect(within(screen.getByText('Ahmed B.').closest('li') as HTMLElement).getByText('Left the group')).toBeInTheDocument())
    expect(removed).toBe(1)
    expect(screen.queryByText('Remove Ahmed B. from the group?')).not.toBeInTheDocument()
  })

  it('lets the owner change their mind', async () => {
    setUp()
    let called = 0
    server.use(http.delete(`${API}/groups/g1/members/u-ahmed`, () => { called++; return new HttpResponse(null, { status: 204 }) }))
    const { user } = renderApp('/groups/g1/members')

    await user.click(within(await rowOf('Ahmed B.')).getByRole('button', { name: 'Remove' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Remove Ahmed B. from the group?')).not.toBeInTheDocument()
    expect(within(await rowOf('Ahmed B.')).getByRole('button', { name: 'Remove' })).toBeInTheDocument()
    expect(called).toBe(0)
  })

  it('explains that a member with a repayment waiting cannot be removed yet, and links to it', async () => {
    setUp()
    server.use(http.delete(`${API}/groups/g1/members/u-ahmed`, () => problem(409, 'PENDING_SETTLEMENTS')))
    const { user } = renderApp('/groups/g1/members')

    await user.click(within(await rowOf('Ahmed B.')).getByRole('button', { name: 'Remove' }))
    await user.click(screen.getByRole('button', { name: 'Yes, remove' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('A repayment is still waiting for a decision.')
    expect(screen.getByRole('link', { name: 'See the repayments' })).toHaveAttribute('href', '/groups/g1/settlements')
  })

  it('transfers the ownership: the former owner becomes an ordinary member and loses the owner tools', async () => {
    const members = FRIENDS.map((m) => ({ ...m }))
    setUp({}, members)
    let body: Body | null = null
    server.use(http.post(`${API}/groups/g1/transfer-ownership`, async ({ request }) => {
      body = (await request.json()) as Body
      members[0] = { ...members[0], role: 'MEMBER' }
      members[1] = { ...members[1], role: 'OWNER' }
      const nowAMember = group({ id: 'g1', myRole: 'MEMBER', ownerId: 'u-ahmed' })
      groupIs(nowAMember)           // the server answers the same from now on, when the group is read again
      return HttpResponse.json(nowAMember)
    }))
    membersAre('g1', members)
    const { user } = renderApp('/groups/g1/members')

    await user.click(within(await rowOf('Ahmed B.')).getByRole('button', { name: 'Make owner' }))
    expect(screen.getByText('Make Ahmed B. the owner?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Yes, transfer ownership' }))

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument())
    expect(body).toEqual({ newOwnerId: 'u-ahmed' })
    expect(screen.queryByRole('heading', { name: 'Invite people' })).not.toBeInTheDocument()
    expect(within(await rowOf('Ahmed B.')).getByText('Owner')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave this group' })).toBeInTheDocument()
  })
})

describe('MembersPage: leaving', () => {
  it('tells the owner to transfer the ownership first', async () => {
    setUp({ myRole: 'OWNER' })
    renderApp('/groups/g1/members')

    expect(await screen.findByText(/transfer the ownership to another member before you can leave/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Leave this group' })).not.toBeInTheDocument()
  })

  it('does not send a lone owner into a dead end: nobody to hand the group to, so it points to archiving', async () => {
    setUp({ myRole: 'OWNER' }, [FRIENDS[0]])
    renderApp('/groups/g1/members')

    expect(await screen.findByText(/You are the only member of this group/)).toBeInTheDocument()
    expect(screen.queryByText(/transfer the ownership to another member/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open the settings' })).toHaveAttribute('href', '/groups/g1/settings')
  })

  it('lets a member leave after a confirmation, and returns to their groups', async () => {
    setUp({ myRole: 'MEMBER' })
    let left = 0
    server.use(http.post(`${API}/groups/g1/leave`, () => { left++; return new HttpResponse(null, { status: 204 }) }))
    groupsAre([])
    const { user, router } = renderApp('/groups/g1/members')

    await user.click(await screen.findByRole('button', { name: 'Leave this group' }))
    expect(screen.getByText('Leave this group?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Yes, leave' }))

    expect(await screen.findByRole('heading', { name: 'Your groups' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/groups')
    expect(left).toBe(1)
  })

  it('refuses while the balance is not zero, says so, links to the balances, and stays', async () => {
    setUp({ myRole: 'MEMBER' })
    server.use(http.post(`${API}/groups/g1/leave`, () => problem(422, 'BALANCE_NOT_SETTLED')))
    const { user, router } = renderApp('/groups/g1/members')

    await user.click(await screen.findByRole('button', { name: 'Leave this group' }))
    await user.click(screen.getByRole('button', { name: 'Yes, leave' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The balance must be zero first.')
    expect(screen.getByRole('link', { name: 'See the balances' })).toHaveAttribute('href', '/groups/g1/balances')
    expect(router.state.location.pathname).toBe('/groups/g1/members')
  })

  it('offers nothing to someone who already left, nor in an archived group', async () => {
    setUp({ myRole: 'MEMBER' }, [member({ userId: 'u-youssef', role: 'MEMBER', status: 'INACTIVE' }), ...FRIENDS.slice(1)])
    const left = renderApp('/groups/g1/members')
    await rowOf('Ahmed B.')
    expect(screen.queryByRole('button', { name: 'Leave this group' })).not.toBeInTheDocument()
    left.unmount()

    setUp({ myRole: 'OWNER', status: 'ARCHIVED' })
    renderApp('/groups/g1/members')
    await rowOf('Ahmed B.')
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Invite people' })).not.toBeInTheDocument()
    expect(screen.queryByText('Leave the group')).not.toBeInTheDocument()
  })
})

describe('MembersPage: invitations', () => {
  function createWorks(secret = 'ABCD-EFGH', all: InvitationSummary[] = []) {
    const sent: { body: Body | null } = { body: null }
    server.use(http.post(`${API}/groups/g1/invitations`, async ({ request }) => {
      sent.body = (await request.json()) as Body
      all.unshift(invitation({ id: 'new', type: sent.body.type as 'CODE' | 'LINK' }))
      return HttpResponse.json({ id: 'new', type: sent.body.type, secret, maxUses: sent.body.maxUses, expiresAt: '2026-11-14T00:00:00Z' }, { status: 201 })
    }))
    return sent
  }

  it('creates a short code and shows it, with the link to send, once', async () => {
    const all = setUp()
    const sent = createWorks('ABCD-EFGH', all)
    const { user } = renderApp('/groups/g1/members')

    await user.click(await screen.findByRole('button', { name: 'Create invitation' }))

    const card = (await screen.findByText('Invitation created')).closest('div') as HTMLElement
    expect(sent.body).toEqual({ type: 'CODE', expiresInDays: 7, maxUses: 5 })
    expect(within(card).getByText('ABCD-EFGH')).toBeInTheDocument()
    expect(within(card).getByText(`${window.location.origin}/join/ABCD-EFGH`)).toBeInTheDocument()
    expect(within(card).getByText('Copy it now: for safety it is shown only this once.')).toBeInTheDocument()
  })

  it('creates a link with the chosen validity and number of uses', async () => {
    const all = setUp()
    const sent = createWorks('q3Vn_8xTkL2m-ZpR7sYwB1aCdEfGhJkLmNoPqRsTuVw', all)
    const { user } = renderApp('/groups/g1/members')
    await user.click(await screen.findByRole('radio', { name: 'Link' }))
    await user.selectOptions(screen.getByLabelText('Valid for (days)'), '30')
    await user.clear(screen.getByLabelText('How many people can use it'))
    await user.type(screen.getByLabelText('How many people can use it'), '12')

    await user.click(screen.getByRole('button', { name: 'Create invitation' }))

    await screen.findByText('Invitation created')
    expect(sent.body).toEqual({ type: 'LINK', expiresInDays: 30, maxUses: 12 })
    expect(screen.getByText(`${window.location.origin}/join/q3Vn_8xTkL2m-ZpR7sYwB1aCdEfGhJkLmNoPqRsTuVw`)).toBeInTheDocument()
  })

  it('refuses a number of uses the server would refuse, without calling it', async () => {
    setUp()
    const sent = createWorks()
    const { user } = renderApp('/groups/g1/members')
    const field = await screen.findByLabelText('How many people can use it')

    for (const bad of ['0', '51', 'x', '2.5', '']) {
      await user.clear(field)
      if (bad) await user.type(field, bad)
      await user.click(screen.getByRole('button', { name: 'Create invitation' }))
      expect(await screen.findByText('Enter a whole number from 1 to 50'), bad).toBeInTheDocument()
    }
    expect(sent.body).toBeNull()
  })

  it('copies the code and the link, and says when it could not', async () => {
    const all = setUp()
    createWorks('ABCD-EFGH', all)
    const { user } = renderApp('/groups/g1/members')
    await user.click(await screen.findByRole('button', { name: 'Create invitation' }))

    await user.click(await screen.findByRole('button', { name: 'Copy code' }))
    expect(await screen.findByText('Code copied.')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe('ABCD-EFGH')

    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(await screen.findByText('Link copied.')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/join/ABCD-EFGH`)

    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'))
    await user.click(screen.getByRole('button', { name: 'Copy code' }))
    expect(await screen.findByText(/Could not copy automatically/)).toBeInTheDocument()
  })

  it('lists the invitations with their state, uses and expiry, and never a secret', async () => {
    setUp({}, FRIENDS, [
      invitation({ id: 'a', type: 'CODE', status: 'PENDING', useCount: 2, maxUses: 5, expiresAt: '2026-11-20T00:00:00Z' }),
      invitation({ id: 'b', type: 'LINK', status: 'ACCEPTED', useCount: 3, maxUses: 3, expiresAt: null }),
      invitation({ id: 'c', type: 'CODE', status: 'EXPIRED' }),
      invitation({ id: 'd', type: 'LINK', status: 'REVOKED' }),
    ])
    renderApp('/groups/g1/members')

    const items = await within((await screen.findByRole('heading', { name: 'Invite people' })).closest('section') as HTMLElement).findAllByRole('listitem')

    expect(items).toHaveLength(4)
    expect(items[0].textContent).toContain('Active')
    expect(items[0].textContent).toContain('Used 2 of 5')
    expect(items[0].textContent).toContain('expires 20 Nov 2026')
    expect(items[1].textContent).toContain('Used up')
    expect(items[1].textContent).toContain('no expiry')
    expect(items[2].textContent).toContain('Expired')
    expect(items[3].textContent).toContain('Revoked')
  })

  it('revokes an active invitation only, and the list follows', async () => {
    const all = setUp({}, FRIENDS, [invitation({ id: 'a', status: 'PENDING' }), invitation({ id: 'b', status: 'EXPIRED' })])
    let revoked = 0
    server.use(http.delete(`${API}/groups/g1/invitations/a`, () => {
      revoked++
      all[0] = { ...all[0], status: 'REVOKED' }
      return new HttpResponse(null, { status: 204 })
    }))
    const { user } = renderApp('/groups/g1/members')

    const buttons = await screen.findAllByRole('button', { name: 'Revoke' })
    expect(buttons).toHaveLength(1)
    await user.click(buttons[0])

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument())
    expect(revoked).toBe(1)
  })

  it('explains a refusal when creating', async () => {
    setUp()
    server.use(http.post(`${API}/groups/g1/invitations`, () => problem(403, 'FORBIDDEN')))
    const { user } = renderApp('/groups/g1/members')

    await user.click(await screen.findByRole('button', { name: 'Create invitation' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('You are not allowed to do this.')
  })

  it('is a section of the group, in French too', async () => {
    setUp()
    const { user } = renderApp('/groups/g1/members')
    const tabs = await screen.findByRole('navigation', { name: 'Group sections' })
    expect(within(tabs).getByRole('link', { name: 'Members' })).toHaveAttribute('aria-current', 'page')

    await user.selectOptions(screen.getByLabelText('Language'), 'fr')

    expect(await screen.findByRole('heading', { name: 'Inviter des personnes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "Créer l'invitation" })).toBeInTheDocument()
  })
})
