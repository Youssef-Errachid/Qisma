import { screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, asSignedIn, group, groupIs, membersAre, problem, settlement, settlementsAre } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'
import type { SettlementResponse } from '@/types/api'

const plain = (text: string | null) => (text ?? '').replace(/[\s\u00a0\u202f]/g, ' ')

// Ahmed pays Youssef (the user decides), Youssef pays Hamza (the user can withdraw), Ahmed pays Hamza (not the user's business)
const TO_ME = settlement({ id: 's-to-me', fromUserId: 'u-ahmed', fromUsername: 'ahmed', toUserId: 'u-youssef', toUsername: 'youssef', amountMinor: 5000 })
const FROM_ME = settlement({ id: 's-from-me', fromUserId: 'u-youssef', fromUsername: 'youssef', toUserId: 'u-hamza', toUsername: 'hamza', amountMinor: 3000 })
const OTHERS = settlement({ id: 's-others', fromUserId: 'u-ahmed', fromUsername: 'ahmed', toUserId: 'u-hamza', toUsername: 'hamza', amountMinor: 700 })

function setUp(all: SettlementResponse[], groupOverrides = {}) {
  asSignedIn()
  groupIs(group({ id: 'g1', ...groupOverrides }))
  membersAre('g1')
  return settlementsAre('g1', all)
}

const waitingSection = async () => (await screen.findByRole('heading', { name: 'Waiting for a decision' })).closest('section') as HTMLElement
const historySection = async () => (await screen.findByRole('heading', { name: 'History' })).closest('section') as HTMLElement

describe('SettlementsPage: waiting for a decision', () => {
  it('gives each person only the buttons that are theirs', async () => {
    setUp([TO_ME, FROM_ME, OTHERS])
    renderApp('/groups/g1/settlements')

    const waiting = await waitingSection()
    const cards = await within(waiting).findAllByRole('listitem')

    expect(cards).toHaveLength(3)
    // paid to the user: decide
    expect(within(cards[0]).getByRole('button', { name: 'Confirm I received it' })).toBeInTheDocument()
    expect(within(cards[0]).getByRole('button', { name: 'Reject' })).toBeInTheDocument()
    expect(within(cards[0]).queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument()
    // declared by the user: withdraw
    expect(within(cards[1]).getByRole('button', { name: 'Withdraw' })).toBeInTheDocument()
    expect(within(cards[1]).queryByRole('button', { name: 'Confirm I received it' })).not.toBeInTheDocument()
    // between two others: nothing
    expect(within(cards[2]).queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows who pays whom and how much, with "You" for the user', async () => {
    setUp([TO_ME, FROM_ME])
    renderApp('/groups/g1/settlements')

    const cards = await within(await waitingSection()).findAllByRole('listitem')

    expect(plain(cards[0].textContent)).toContain('Ahmed B. →')
    expect(plain(cards[0].textContent)).toContain('You')
    expect(plain(cards[0].textContent)).toContain('MAD 50.00')
    expect(plain(cards[1].textContent)).toContain('You →')
    expect(plain(cards[1].textContent)).toContain('Hamza K.')
  })

  it('shows the note of a repayment', async () => {
    setUp([{ ...TO_ME, note: 'cash, at lunch' }])
    renderApp('/groups/g1/settlements')

    // the repayment is in the waiting list and, as a record, in the history
    expect(await screen.findAllByText('“cash, at lunch”')).toHaveLength(2)
  })

  it('says nothing waits when nothing does', async () => {
    setUp([])
    renderApp('/groups/g1/settlements')

    expect(await screen.findByText('Nothing is waiting for a decision.')).toBeInTheDocument()
    expect(await screen.findByText('No repayments yet')).toBeInTheDocument()
  })

  it('keeps the buttons in the "waiting" section only: the history just reports', async () => {
    setUp([TO_ME])
    renderApp('/groups/g1/settlements')

    await within(await waitingSection()).findByRole('button', { name: 'Confirm I received it' })
    const history = await historySection()
    await within(history).findByText('MAD 50.00')

    expect(within(history).queryByRole('button', { name: 'Confirm I received it' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Confirm I received it' })).toHaveLength(1)
  })
})

describe('SettlementsPage: deciding', () => {
  it('confirms a payment: it leaves the waiting list and appears as confirmed', async () => {
    const all = [TO_ME]
    setUp(all)
    let confirmed = 0
    server.use(http.post(`${API}/groups/g1/settlements/s-to-me/confirm`, () => {
      confirmed++
      all[0] = { ...TO_ME, status: 'CONFIRMED', confirmedAt: '2026-11-06T10:00:00Z' }
      return HttpResponse.json(all[0])
    }))
    const { user } = renderApp('/groups/g1/settlements')

    await user.click(await screen.findByRole('button', { name: 'Confirm I received it' }))

    expect(await screen.findByText('Nothing is waiting for a decision.')).toBeInTheDocument()
    const [card] = await within(await historySection()).findAllByRole('listitem')
    expect(within(card).getByText('Confirmed')).toBeInTheDocument()
    expect(confirmed).toBe(1)
  })

  it('rejects a payment with the reason that was typed', async () => {
    const all = [TO_ME]
    setUp(all)
    let body: unknown = null
    server.use(http.post(`${API}/groups/g1/settlements/s-to-me/reject`, async ({ request }) => {
      body = await request.json()
      all[0] = { ...TO_ME, status: 'REJECTED', rejectionReason: 'not received' }
      return HttpResponse.json(all[0])
    }))
    const { user } = renderApp('/groups/g1/settlements')

    await user.click(await screen.findByRole('button', { name: 'Reject' }))
    await user.type(screen.getByLabelText('Reason (optional)'), '  not received  ')
    await user.click(screen.getByRole('button', { name: 'Reject this payment' }))

    expect(await screen.findByText('Reason: not received')).toBeInTheDocument()
    expect(body).toEqual({ reason: 'not received' })
  })

  it('rejects without a reason, and sends no reason', async () => {
    const all = [TO_ME]
    setUp(all)
    let body: unknown = null
    server.use(http.post(`${API}/groups/g1/settlements/s-to-me/reject`, async ({ request }) => {
      body = await request.json()
      all[0] = { ...TO_ME, status: 'REJECTED' }
      return HttpResponse.json(all[0])
    }))
    const { user } = renderApp('/groups/g1/settlements')

    await user.click(await screen.findByRole('button', { name: 'Reject' }))
    await user.click(screen.getByRole('button', { name: 'Reject this payment' }))

    await waitFor(() => expect(screen.getByText('Nothing is waiting for a decision.')).toBeInTheDocument())
    expect(body).toEqual({})
  })

  it('lets the user change their mind before rejecting', async () => {
    setUp([TO_ME])
    let called = 0
    server.use(http.post(`${API}/groups/g1/settlements/s-to-me/reject`, () => { called++; return HttpResponse.json(TO_ME) }))
    const { user } = renderApp('/groups/g1/settlements')

    await user.click(await screen.findByRole('button', { name: 'Reject' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('button', { name: 'Confirm I received it' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Reason (optional)')).not.toBeInTheDocument()
    expect(called).toBe(0)
  })

  it('withdraws a payment the user declared', async () => {
    const all = [FROM_ME]
    setUp(all)
    server.use(http.post(`${API}/groups/g1/settlements/s-from-me/cancel`, () => {
      all[0] = { ...FROM_ME, status: 'CANCELLED' }
      return HttpResponse.json(all[0])
    }))
    const { user } = renderApp('/groups/g1/settlements')

    await user.click(await screen.findByRole('button', { name: 'Withdraw' }))

    expect(await screen.findByText('Nothing is waiting for a decision.')).toBeInTheDocument()
    const [card] = await within(await historySection()).findAllByRole('listitem')
    expect(within(card).getByText('Cancelled')).toBeInTheDocument()
  })

  it('reloads the list when the payment was already handled by someone else, and says so', async () => {
    const all = [TO_ME]
    const seen = setUp(all)
    server.use(http.post(`${API}/groups/g1/settlements/s-to-me/confirm`, () => {
      all[0] = { ...TO_ME, status: 'CONFIRMED' }          // handled from another tab, meanwhile
      return problem(409, 'SETTLEMENT_NOT_PENDING')
    }))
    const { user } = renderApp('/groups/g1/settlements')
    await screen.findByRole('button', { name: 'Confirm I received it' })
    const before = seen.length

    await user.click(screen.getByRole('button', { name: 'Confirm I received it' }))

    expect(await screen.findByText('Nothing is waiting for a decision.')).toBeInTheDocument()
    expect(seen.length).toBeGreaterThan(before)
  })

  it('explains any other refusal and keeps the buttons', async () => {
    setUp([TO_ME])
    server.use(http.post(`${API}/groups/g1/settlements/s-to-me/confirm`, () => problem(403, 'FORBIDDEN')))
    const { user } = renderApp('/groups/g1/settlements')

    await user.click(await screen.findByRole('button', { name: 'Confirm I received it' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('You are not allowed to do this.')
    expect(screen.getByRole('button', { name: 'Confirm I received it' })).toBeInTheDocument()
  })

  it('shows no buttons in an archived group, and no way to declare a payment', async () => {
    setUp([TO_ME, FROM_ME], { status: 'ARCHIVED' })
    renderApp('/groups/g1/settlements')

    await within(await waitingSection()).findAllByRole('listitem')

    expect(screen.queryByRole('button', { name: 'Confirm I received it' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Declare a payment' })).not.toBeInTheDocument()
  })
})

describe('SettlementsPage: the history', () => {
  const confirmed = (n: number) => settlement({ id: `c${n}`, status: 'CONFIRMED', createdAt: `2026-10-${String(10 + (n % 15)).padStart(2, '0')}T10:00:00Z` })

  it('filters by status and writes the filter in the address', async () => {
    const seen = setUp([TO_ME, settlement({ id: 'done', status: 'CONFIRMED' }), settlement({ id: 'no', status: 'REJECTED', rejectionReason: 'wrong amount' })])
    const { user, router } = renderApp('/groups/g1/settlements')
    await within(await historySection()).findAllByRole('listitem')

    await user.selectOptions(screen.getByLabelText('Status'), 'Rejected')

    await waitFor(() => expect(seen.at(-1)).toMatchObject({ status: 'REJECTED', page: '0' }))
    expect(await screen.findByText('Reason: wrong amount')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?status=REJECTED')
  })

  it('opens with the filter of the address, and ignores a status that does not exist', async () => {
    const seen = setUp([settlement({ id: 'done', status: 'CONFIRMED' })])
    renderApp('/groups/g1/settlements?status=CONFIRMED')
    await within(await historySection()).findAllByRole('listitem')
    expect(seen.find((r) => r.status === 'CONFIRMED' && r.size === '20')).toBeDefined()
    expect(screen.getByLabelText('Status')).toHaveValue('CONFIRMED')
  })

  it('opens the unfiltered history for a mangled address', async () => {
    const seen = setUp([settlement({ id: 'done', status: 'CONFIRMED' })])
    renderApp('/groups/g1/settlements?status=NOPE&page=-3')
    await within(await historySection()).findAllByRole('listitem')

    expect(seen.filter((r) => r.size === '20').every((r) => !('status' in r) && r.page === '0')).toBe(true)
  })

  it('pages through a long history', async () => {
    const seen = setUp(Array.from({ length: 45 }, (_, n) => confirmed(n)))
    const { user, router } = renderApp('/groups/g1/settlements')

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument()
    expect(seen.at(-1)).toMatchObject({ page: '1', size: '20' })
    expect(router.state.location.search).toBe('?page=1')
  })

  it('says what went wrong with the history, and lets the user try again', async () => {
    setUp([])
    server.use(http.get(`${API}/groups/g1/settlements`, ({ request }) =>
      new URL(request.url).searchParams.get('size') === '20' ? problem(500, 'INTERNAL_ERROR') : HttpResponse.json({ items: [], page: 0, size: 100, totalElements: 0, totalPages: 0 })))
    const { user } = renderApp('/groups/g1/settlements')

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
    settlementsAre('g1', [settlement({ id: 'back', status: 'CONFIRMED' })])
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    const [card] = await within(await historySection()).findAllByRole('listitem')
    expect(within(card).getByText('Confirmed')).toBeInTheDocument()
  })

  it('is a section of the group, in French too', async () => {
    setUp([TO_ME])
    const { user } = renderApp('/groups/g1/settlements')
    const tabs = await screen.findByRole('navigation', { name: 'Group sections' })
    expect(within(tabs).getByRole('link', { name: 'Repayments' })).toHaveAttribute('aria-current', 'page')

    await user.selectOptions(screen.getByLabelText('Language'), 'fr')

    expect(await screen.findByRole('button', { name: "Je confirme l'avoir reçu" })).toBeInTheDocument()
  })
})
