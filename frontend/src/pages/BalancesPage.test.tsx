import { screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, BALANCES, asSignedIn, balance, balancesAre, group, groupIs, problem, settlement, settlementsAre, suggestionsAre } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'
import type { BalancesResponse } from '@/types/api'

const plain = (text: string | null) => (text ?? '').replace(/[\s\u00a0\u202f]/g, ' ')

function setUp(balances: BalancesResponse = BALANCES, groupOverrides = {}) {
  asSignedIn()
  groupIs(group({ id: 'g1', ...groupOverrides }))
  balancesAre('g1', balances)
  suggestionsAre('g1', [])
  settlementsAre('g1', [])
}

const book = (...members: ReturnType<typeof balance>[]): BalancesResponse => ({ currency: 'MAD', sumMinor: members.reduce((s, m) => s + m.netMinor, 0), members })

describe('BalancesPage: your position', () => {
  it('says what you should receive, in green', async () => {
    setUp()
    renderApp('/groups/g1/balances')

    const card = (await screen.findByText('Your position')).closest('div') as HTMLElement

    expect(plain(card.textContent)).toContain('You should receive MAD 100.00')
    expect(within(card).getByText('You should receive').closest('p')).toHaveClass('text-credit')
  })

  it('says what you owe, in red', async () => {
    setUp(book(
      balance({ userId: 'u-youssef', netMinor: -25333 }),
      balance({ userId: 'u-ahmed', username: 'ahmed', fullName: 'Ahmed B.', netMinor: 25333 }),
    ))
    renderApp('/groups/g1/balances')

    const card = (await screen.findByText('Your position')).closest('div') as HTMLElement

    expect(plain(card.textContent)).toContain('You owe MAD 253.33')
    expect(within(card).getByText('You owe').closest('p')).toHaveClass('text-debt')
  })

  it('says you are settled up, neutrally', async () => {
    setUp(book(balance({ userId: 'u-youssef', netMinor: 0 }), balance({ userId: 'u-ahmed', fullName: 'Ahmed B.', netMinor: 0 })))
    renderApp('/groups/g1/balances')

    const card = (await screen.findByText('Your position')).closest('div') as HTMLElement

    expect(within(card).getByText('You are all settled up')).toBeInTheDocument()
    expect(within(card).queryByText(/You should receive|You owe/)).not.toBeInTheDocument()
  })

  it('shows where you end up once the repayments that are waiting are confirmed', async () => {
    setUp(book(
      balance({ userId: 'u-youssef', netMinor: 10000, pendingInMinor: 4000, effectiveNetMinor: 6000 }),
      balance({ userId: 'u-ahmed', fullName: 'Ahmed B.', netMinor: -10000, pendingOutMinor: 4000, effectiveNetMinor: -6000 }),
    ))
    renderApp('/groups/g1/balances')

    const card = (await screen.findByText('Your position')).closest('div') as HTMLElement

    expect(plain(card.textContent)).toContain('MAD 100.00')
    expect(plain(card.textContent)).toContain('Once the repayments that are waiting are confirmed: You should receive MAD 60.00')
  })
})

describe('BalancesPage: the balance of each member', () => {
  it('lists those owed first, then those who owe, with the paid amount, the share and the balance', async () => {
    setUp()
    renderApp('/groups/g1/balances')

    const table = await screen.findByRole('table', { name: 'Balance of each member' })
    const rows = within(table).getAllByRole('row').slice(1)

    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual(['Youssef E.You', 'Hamza K.', 'Ahmed B.'])
    const cells = (row: HTMLElement) => within(row).getAllByRole('cell').map((c) => plain(c.textContent))
    expect(cells(rows[0])).toEqual(['MAD 300.00', 'MAD 200.00', 'MAD 100.00'])
    expect(cells(rows[2])).toEqual(['MAD 50.00', 'MAD 200.00', '-MAD 150.00'])
  })

  it('colours the balances: green to receive, red owed', async () => {
    setUp()
    renderApp('/groups/g1/balances')

    const rows = within(await screen.findByRole('table', { name: 'Balance of each member' })).getAllByRole('row').slice(1)

    expect(within(rows[0]).getAllByRole('cell').at(-1)?.querySelector('bdi')).toHaveClass('text-credit')
    expect(within(rows[2]).getAllByRole('cell').at(-1)?.querySelector('bdi')).toHaveClass('text-debt')
  })

  it('marks a member who left, and shows what they have waiting', async () => {
    setUp(book(
      balance({ userId: 'u-youssef', netMinor: 10000 }),
      balance({ userId: 'u-ahmed', fullName: 'Ahmed B.', netMinor: -10000, membershipStatus: 'INACTIVE', pendingOutMinor: 3000, effectiveNetMinor: -7000 }),
    ))
    renderApp('/groups/g1/balances')

    const row = (await screen.findByText('Ahmed B.')).closest('tr') as HTMLElement

    expect(within(row).getByText('Left the group')).toBeInTheDocument()
    expect(plain(row.textContent)).toContain('Waiting to pay: MAD 30.00')
  })

  it('warns when the accounts do not add up to zero (which should never happen)', async () => {
    setUp({ ...BALANCES, sumMinor: 1 })
    renderApp('/groups/g1/balances')

    expect(await screen.findByRole('alert')).toHaveTextContent('do not add up to zero')
  })

  it('says what went wrong and lets the user try again', async () => {
    asSignedIn()
    groupIs(group({ id: 'g1' }))
    suggestionsAre('g1', [])
    settlementsAre('g1', [])
    server.use(http.get(`${API}/groups/g1/balances`, () => problem(500, 'INTERNAL_ERROR')))
    const { user } = renderApp('/groups/g1/balances')

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
    balancesAre('g1')
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('table', { name: 'Balance of each member' })).toBeInTheDocument()
  })
})

describe('BalancesPage: how to settle up', () => {
  const ahmedPaysYoussef = { fromUserId: 'u-ahmed', fromUsername: 'ahmed', toUserId: 'u-youssef', toUsername: 'youssef', amountMinor: 10000 }
  const youssefPaysHamza = { fromUserId: 'u-youssef', fromUsername: 'youssef', toUserId: 'u-hamza', toUsername: 'hamza', amountMinor: 3000 }

  it('offers the person who has to pay a button that opens the form already filled in', async () => {
    setUp()
    suggestionsAre('g1', [youssefPaysHamza])
    renderApp('/groups/g1/balances')

    const link = await screen.findByRole('link', { name: 'Declare my payment' })

    expect(link).toHaveAttribute('href', '/groups/g1/settlements/new?to=u-hamza&amount=3000')
  })

  it('tells the person who is to be paid that they are waiting for it, with no button', async () => {
    setUp()
    suggestionsAre('g1', [ahmedPaysYoussef])
    renderApp('/groups/g1/balances')

    expect(await screen.findByText('Waiting for them to pay you')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Declare my payment' })).not.toBeInTheDocument()
  })

  it('names "You" in the suggestion, and shows the others by name, with no button for a payment between two others', async () => {
    setUp()
    suggestionsAre('g1', [youssefPaysHamza, { fromUserId: 'u-ahmed', fromUsername: 'ahmed', toUserId: 'u-hamza', toUsername: 'hamza', amountMinor: 500 }])
    renderApp('/groups/g1/balances')

    const section = (await screen.findByRole('heading', { name: 'How to settle up' })).closest('section') as HTMLElement
    const items = await within(section).findAllByRole('listitem')

    expect(plain(items[0].textContent)).toContain('You')
    expect(plain(items[0].textContent)).toContain('Hamza K.')
    expect(plain(items[0].textContent)).toContain('MAD 30.00')
    expect(within(items[1]).queryByRole('link')).not.toBeInTheDocument()
    expect(within(items[1]).queryByText('Waiting for them to pay you')).not.toBeInTheDocument()
  })

  it('names people the way the table above does (their full name), not by username', async () => {
    setUp()
    suggestionsAre('g1', [
      { fromUserId: 'u-ahmed', fromUsername: 'ahmed', toUserId: 'u-hamza', toUsername: 'hamza', amountMinor: 500 },
    ])
    renderApp('/groups/g1/balances')

    const section = (await screen.findByRole('heading', { name: 'How to settle up' })).closest('section') as HTMLElement
    const [item] = await within(section).findAllByRole('listitem')

    expect(plain(item.textContent)).toContain('Ahmed B.')
    expect(plain(item.textContent)).toContain('Hamza K.')
    expect(plain(item.textContent)).not.toContain('ahmed')
  })

  it('falls back to the username for someone the balances do not list', async () => {
    setUp()
    suggestionsAre('g1', [
      { fromUserId: 'u-ghost', fromUsername: 'ghost', toUserId: 'u-hamza', toUsername: 'hamza', amountMinor: 500 },
    ])
    renderApp('/groups/g1/balances')

    const section = (await screen.findByRole('heading', { name: 'How to settle up' })).closest('section') as HTMLElement
    const [item] = await within(section).findAllByRole('listitem')

    expect(plain(item.textContent)).toContain('ghost')
    expect(plain(item.textContent)).toContain('Hamza K.')
  })

  it('says everyone is settled up when nothing is owed', async () => {
    setUp(book(balance({ userId: 'u-youssef', netMinor: 0 }), balance({ userId: 'u-ahmed', fullName: 'Ahmed B.', netMinor: 0 })))
    renderApp('/groups/g1/balances')

    expect(await screen.findByText('Everyone is settled up.')).toBeInTheDocument()
  })

  it('explains an empty suggestion when repayments that are waiting already cover what is owed', async () => {
    setUp(book(
      balance({ userId: 'u-youssef', netMinor: 10000, effectiveNetMinor: 0, pendingInMinor: 10000 }),
      balance({ userId: 'u-ahmed', fullName: 'Ahmed B.', netMinor: -10000, effectiveNetMinor: 0, pendingOutMinor: 10000 }),
    ))
    renderApp('/groups/g1/balances')

    expect(await screen.findByText(/Nothing to suggest right now/)).toBeInTheDocument()
  })

  it('offers no payment button in an archived group', async () => {
    setUp(BALANCES, { status: 'ARCHIVED' })
    suggestionsAre('g1', [youssefPaysHamza])
    renderApp('/groups/g1/balances')

    await screen.findByText('MAD 30.00')

    expect(screen.queryByRole('link', { name: 'Declare my payment' })).not.toBeInTheDocument()
  })
})

describe('BalancesPage: repayments waiting for you', () => {
  it('tells you how many wait for your confirmation, and links to them', async () => {
    setUp()
    settlementsAre('g1', [
      settlement({ id: 's1', toUserId: 'u-youssef' }),
      settlement({ id: 's2', toUserId: 'u-youssef', fromUserId: 'u-hamza', fromUsername: 'hamza' }),
      settlement({ id: 's3', fromUserId: 'u-ahmed', toUserId: 'u-hamza', toUsername: 'hamza' }),
    ])
    renderApp('/groups/g1/balances')

    expect(await screen.findByText('Repayments waiting for your confirmation: 2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute('href', '/groups/g1/settlements')
  })

  it('says nothing when none waits for you', async () => {
    setUp()
    settlementsAre('g1', [settlement({ fromUserId: 'u-youssef', toUserId: 'u-ahmed' })])
    renderApp('/groups/g1/balances')

    await screen.findByRole('table', { name: 'Balance of each member' })

    expect(screen.queryByText(/waiting for your confirmation/)).not.toBeInTheDocument()
  })
})

describe('BalancesPage: a section of the group', () => {
  it('has its tab active, and shows the amounts the French way', async () => {
    setUp()
    const { user } = renderApp('/groups/g1/balances')
    const tabs = await screen.findByRole('navigation', { name: 'Group sections' })
    expect(within(tabs).getByRole('link', { name: 'Balances' })).toHaveAttribute('aria-current', 'page')

    await user.selectOptions(screen.getByLabelText('Language'), 'fr')

    expect(await screen.findByText('Vous devez recevoir')).toBeInTheDocument()
    expect(plain(screen.getByText(/Vous devez recevoir/).closest('p')?.textContent ?? '')).toContain('100,00 MAD')
  })

  it('is not bothered by a failure in the suggestions: the balances still show', async () => {
    setUp()
    server.use(http.get(`${API}/groups/g1/settlements/suggestions`, () => HttpResponse.json({ status: 500 }, { status: 500 })))
    renderApp('/groups/g1/balances')

    expect(await screen.findByRole('table', { name: 'Balance of each member' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
