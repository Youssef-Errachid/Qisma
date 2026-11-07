import { screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, FRIENDS, asSignedIn, balance, balancesAre, group, groupIs, member, membersAre, problem, settlement, settlementsAre } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'
import type { BalancesResponse, MemberResponse } from '@/types/api'

type Body = Record<string, unknown>

/** Youssef (the user) owes 100.00 in all: Ahmed is owed 150.00, Hamza owes 50.00 as well. */
const OWES: BalancesResponse = {
  currency: 'MAD', sumMinor: 0,
  members: [
    balance({ userId: 'u-youssef', username: 'youssef', fullName: 'Youssef E.', netMinor: -10000 }),
    balance({ userId: 'u-ahmed', username: 'ahmed', fullName: 'Ahmed B.', netMinor: 15000 }),
    balance({ userId: 'u-hamza', username: 'hamza', fullName: 'Hamza K.', netMinor: -5000 }),
  ],
}

function setUp(balances = OWES, groupOverrides = {}, members: MemberResponse[] = FRIENDS) {
  asSignedIn()
  groupIs(group({ id: 'g1', ...groupOverrides }))
  membersAre('g1', members)
  balancesAre('g1', balances)
  settlementsAre('g1', [])
  const sent: { bodies: Body[]; keys: Array<string | null> } = { bodies: [], keys: [] }
  server.use(http.post(`${API}/groups/g1/settlements`, async ({ request }) => {
    sent.bodies.push((await request.json()) as Body)
    sent.keys.push(request.headers.get('Idempotency-Key'))
    return HttpResponse.json(settlement({ id: 'new', fromUserId: 'u-youssef', toUserId: 'u-ahmed' }), { status: 201 })
  }))
  return sent
}

const plain = (text: string | null) => (text ?? '').replace(/[\s\u00a0\u202f]/g, ' ')

describe('NewSettlementPage: the form', () => {
  it('opens already filled in from a suggestion, and says how much can be paid', async () => {
    setUp()
    renderApp('/groups/g1/settlements/new?to=u-ahmed&amount=10000')

    expect(await screen.findByLabelText('Pay to')).toHaveValue('u-ahmed')
    expect(screen.getByLabelText('Amount (MAD)')).toHaveValue('100.00')
    expect(plain(screen.getByText(/Up to/).textContent)).toBe('Up to MAD 100.00 right now')
  })

  it('offers everybody but the user, including someone who left (a debt to them still has to be settled)', async () => {
    setUp(OWES, {}, [...FRIENDS, member({ userId: 'u-old', username: 'old', fullName: 'Old Friend', role: 'MEMBER', status: 'INACTIVE' })])
    renderApp('/groups/g1/settlements/new')

    const options = within(await screen.findByLabelText('Pay to')).getAllByRole('option').map((o) => o.textContent)

    expect(options).toEqual(['Choose a person', 'Ahmed B.', 'Hamza K.', 'Old Friend'])
  })

  it('ignores an address that names someone who is not in the group, or an amount that is not a number', async () => {
    setUp()
    renderApp('/groups/g1/settlements/new?to=ghost&amount=abc')

    expect(await screen.findByLabelText('Pay to')).toHaveValue('')
    expect(screen.getByLabelText('Amount (MAD)')).toHaveValue('')
  })

  it('says when the user owes this person nothing right now', async () => {
    const { user } = (setUp(), renderApp('/groups/g1/settlements/new'))

    await user.selectOptions(await screen.findByLabelText('Pay to'), 'Hamza K.')

    expect(screen.getByText('You do not owe this person anything right now.')).toBeInTheDocument()
  })
})

describe('NewSettlementPage: declaring a payment', () => {
  it('sends it, with a key that identifies this request, and goes to the repayments with a confirmation', async () => {
    const sent = setUp()
    const { user, router } = renderApp('/groups/g1/settlements/new?to=u-ahmed&amount=10000')
    await screen.findByLabelText('Pay to')

    await user.click(screen.getByRole('button', { name: 'Declare payment' }))

    expect(await screen.findByText('Payment declared. Ahmed B. has to confirm it before it counts.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/groups/g1/settlements')
    expect(sent.bodies).toEqual([{ toUserId: 'u-ahmed', amountMinor: 10000 }])
    expect(sent.keys[0]).toMatch(/^[0-9a-f]{32}-[0-9a-f]{8}$/)
  })

  it('sends the note, trimmed, when there is one', async () => {
    const sent = setUp()
    const { user } = renderApp('/groups/g1/settlements/new')
    await user.selectOptions(await screen.findByLabelText('Pay to'), 'Ahmed B.')
    await user.type(screen.getByLabelText('Amount (MAD)'), '12,5')
    await user.type(screen.getByLabelText('Note (optional)'), '  cash at lunch  ')

    await user.click(screen.getByRole('button', { name: 'Declare payment' }))

    await screen.findByText(/Payment declared/)
    expect(sent.bodies[0]).toEqual({ toUserId: 'u-ahmed', amountMinor: 1250, note: 'cash at lunch' })
  })

  it('refuses more than is still owed, before sending anything, and says the most that can be paid', async () => {
    const sent = setUp()
    const { user } = renderApp('/groups/g1/settlements/new')
    await user.selectOptions(await screen.findByLabelText('Pay to'), 'Ahmed B.')

    await user.type(screen.getByLabelText('Amount (MAD)'), '100.01')

    expect(plain(screen.getByText(/This is more than what is still owed/).textContent)).toBe('This is more than what is still owed: at most MAD 100.00.')
    await user.click(screen.getByRole('button', { name: 'Declare payment' }))
    expect(sent.bodies).toHaveLength(0)

    await user.clear(screen.getByLabelText('Amount (MAD)'))
    await user.type(screen.getByLabelText('Amount (MAD)'), '100')
    expect(screen.queryByText(/This is more than what is still owed/)).not.toBeInTheDocument()
  })

  it('counts the payments already waiting: they use up what is still owed', async () => {
    setUp({
      ...OWES,
      members: [
        balance({ userId: 'u-youssef', netMinor: -10000, effectiveNetMinor: -4000, pendingOutMinor: 6000 }),
        balance({ userId: 'u-ahmed', username: 'ahmed', fullName: 'Ahmed B.', netMinor: 15000, effectiveNetMinor: 9000, pendingInMinor: 6000 }),
        balance({ userId: 'u-hamza', username: 'hamza', fullName: 'Hamza K.', netMinor: -5000 }),
      ],
    })
    const { user } = renderApp('/groups/g1/settlements/new')
    await user.selectOptions(await screen.findByLabelText('Pay to'), 'Ahmed B.')

    await user.type(screen.getByLabelText('Amount (MAD)'), '40.01')

    expect(plain(screen.getByText(/at most/).textContent)).toBe('This is more than what is still owed: at most MAD 40.00.')
  })

  it('asks for a person and an amount, and refuses an amount that is not an amount', async () => {
    const sent = setUp()
    const { user } = renderApp('/groups/g1/settlements/new')

    await user.click(await screen.findByRole('button', { name: 'Declare payment' }))
    expect(await screen.findAllByText('This field is required')).toHaveLength(2)

    await user.selectOptions(screen.getByLabelText('Pay to'), 'Ahmed B.')
    await user.type(screen.getByLabelText('Amount (MAD)'), '12.345')
    await user.click(screen.getByRole('button', { name: 'Declare payment' }))

    expect(await screen.findByText('Enter an amount like 120 or 120.50')).toBeInTheDocument()
    expect(sent.bodies).toHaveLength(0)
  })
})

describe('NewSettlementPage: the key that prevents declaring the money twice', () => {
  it('sends the same key when the same payment is sent again, and another key when it was changed', async () => {
    const sent = setUp()
    server.use(http.post(`${API}/groups/g1/settlements`, async ({ request }) => {
      sent.bodies.push((await request.json()) as Body)
      sent.keys.push(request.headers.get('Idempotency-Key'))
      return problem(409, 'CONCURRENT_UPDATE')
    }))
    const { user } = renderApp('/groups/g1/settlements/new?to=u-ahmed&amount=5000')
    await screen.findByLabelText('Pay to')

    await user.click(screen.getByRole('button', { name: 'Declare payment' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Someone changed the group at the same moment')
    await user.click(screen.getByRole('button', { name: 'Declare payment' }))
    await user.clear(screen.getByLabelText('Amount (MAD)'))
    await user.type(screen.getByLabelText('Amount (MAD)'), '60')
    await user.click(screen.getByRole('button', { name: 'Declare payment' }))

    await screen.findByRole('alert')
    expect(sent.keys).toHaveLength(3)
    expect(sent.keys[1]).toBe(sent.keys[0])          // the same payment again: recognised by the server
    expect(sent.keys[2]).not.toBe(sent.keys[0])      // another amount: a different request
    expect(sent.keys[2]?.slice(0, 32)).toBe(sent.keys[0]?.slice(0, 32))   // still the same open form
  })

  it('treats the answer to a repeated request (200, the existing payment) as a success', async () => {
    setUp()
    server.use(http.post(`${API}/groups/g1/settlements`, () => HttpResponse.json(settlement({ id: 'first' }), { status: 200 })))
    const { user, router } = renderApp('/groups/g1/settlements/new?to=u-ahmed&amount=5000')
    await screen.findByLabelText('Pay to')

    await user.click(screen.getByRole('button', { name: 'Declare payment' }))

    await screen.findByText(/Payment declared/)
    expect(router.state.location.pathname).toBe('/groups/g1/settlements')
  })
})

describe('NewSettlementPage: when the server refuses, and who can open it', () => {
  it('explains that the amount is more than what is owed, and stays on the form', async () => {
    setUp()
    server.use(http.post(`${API}/groups/g1/settlements`, () => problem(422, 'SETTLEMENT_EXCEEDS_BALANCE')))
    const { user, router } = renderApp('/groups/g1/settlements/new?to=u-ahmed&amount=5000')
    await screen.findByLabelText('Pay to')

    await user.click(screen.getByRole('button', { name: 'Declare payment' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The amount is more than what is still owed.')
    expect(router.state.location.pathname).toBe('/groups/g1/settlements/new')
  })

  it('is closed in an archived group', async () => {
    setUp(OWES, { status: 'ARCHIVED' })
    renderApp('/groups/g1/settlements/new')

    expect(await screen.findByText('This group is archived: repayments can no longer be declared.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Pay to')).not.toBeInTheDocument()
  })

  it('says so when nobody else is in the group', async () => {
    setUp(OWES, {}, [FRIENDS[0]])
    renderApp('/groups/g1/settlements/new')

    expect(await screen.findByText('There is nobody else in this group to pay yet.')).toBeInTheDocument()
  })

  it('is open to a member who left, who may still settle what they owe', async () => {
    setUp(OWES, {}, [member({ userId: 'u-youssef', status: 'INACTIVE' }), ...FRIENDS.slice(1)])
    renderApp('/groups/g1/settlements/new')

    expect(await screen.findByLabelText('Pay to')).toBeInTheDocument()
  })

  it('goes back to the repayments with the cancel button', async () => {
    setUp()
    const { user, router } = renderApp('/groups/g1/settlements/new')

    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(await screen.findByText('Waiting for a decision')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/groups/g1/settlements')
  })

  it('speaks French', async () => {
    setUp()
    const { user } = renderApp('/groups/g1/settlements/new?to=u-ahmed&amount=10000')
    await screen.findByLabelText('Pay to')

    await user.selectOptions(screen.getByLabelText('Language'), 'fr')

    expect(await screen.findByLabelText('Payer à')).toHaveValue('u-ahmed')
    expect(screen.getByLabelText('Montant (MAD)')).toHaveValue('100.00')
    expect(plain(screen.getByText(/Jusqu'à/).textContent)).toBe("Jusqu'à 100,00 MAD en ce moment")
  })
})
