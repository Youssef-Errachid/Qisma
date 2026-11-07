import { screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, asSignedIn, expense, expensesAre, group, groupIs, membersAre, pageOf, problem } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'

function setUp(items = [expense()], overrides = {}) {
  asSignedIn()
  groupIs(group({ id: 'g1' }))
  membersAre('g1')
  expensesAre('g1', pageOf(items, overrides))
}

/** Records the query string of every request for the list. */
function recordRequests() {
  const seen: Array<Record<string, string>> = []
  server.use(http.get(`${API}/groups/g1/expenses`, ({ request }) => {
    seen.push(Object.fromEntries(new URL(request.url).searchParams))
    return HttpResponse.json(pageOf([expense()], { totalElements: 45, totalPages: 3, page: Number(new URL(request.url).searchParams.get('page') ?? 0) }))
  }))
  return seen
}

const plain = (text: string | null) => (text ?? '').replace(/[\s\u00a0\u202f]/g, ' ')

describe('ExpensesPage', () => {
  it('lists the expenses with who paid, the category, the amount and the share of the user', async () => {
    setUp([
      expense({ id: 'e1', title: 'Groceries', amountMinor: 30000, paidBy: 'u-ahmed' }),
      expense({
        id: 'e2', title: 'Ahmed and Hamza only', amountMinor: 8000, category: 'WATER', paidBy: 'u-hamza',
        shares: [{ userId: 'u-ahmed', shareMinor: 4000, percentageBp: null }, { userId: 'u-hamza', shareMinor: 4000, percentageBp: null }],
      }),
    ])
    renderApp('/groups/g1/expenses')

    const groceries = (await screen.findByText('Groceries')).closest('li') as HTMLElement
    expect(within(groceries).getByText('Paid by Ahmed B.')).toBeInTheDocument()
    expect(within(groceries).getByText('Food & groceries')).toBeInTheDocument()
    expect(plain(within(groceries).getByText(/^MAD.300\.00$/).textContent)).toBe('MAD 300.00')
    expect(plain(groceries.textContent)).toContain('Your share: MAD 100.00')

    const water = screen.getByText('Ahmed and Hamza only').closest('li') as HTMLElement
    expect(within(water).getByText('You are not part of this one')).toBeInTheDocument()
    expect(within(water).getByText('Water')).toBeInTheDocument()
    expect(screen.getByText('Total: 2')).toBeInTheDocument()
  })

  it('invites the user to wait for expenses when the group has none', async () => {
    setUp([])
    renderApp('/groups/g1/expenses')

    expect(await screen.findByText('No expenses yet')).toBeInTheDocument()
    expect(screen.queryByText('No expense matches')).not.toBeInTheDocument()
  })

  it('says "no match", not "no expenses", when a filter hides everything', async () => {
    setUp([])
    renderApp('/groups/g1/expenses?category=RENT')

    expect(await screen.findByText('No expense matches')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
  })

  it('asks the server for the first page of 20 with no filter', async () => {
    setUp()
    const seen = recordRequests()
    renderApp('/groups/g1/expenses')

    await screen.findByText('Groceries')

    expect(seen[0]).toEqual({ page: '0', size: '20' })
  })

  it('sends a filter to the server, goes back to the first page, and writes it in the address', async () => {
    setUp()
    const seen = recordRequests()
    const { user, router } = renderApp('/groups/g1/expenses?page=2')
    await screen.findByText('Groceries')

    await user.selectOptions(screen.getByLabelText('Category'), 'RENT')

    await waitFor(() => expect(seen.at(-1)).toEqual({ page: '0', size: '20', category: 'RENT' }))
    expect(router.state.location.search).toBe('?category=RENT')
  })

  it('filters by who paid and by who takes part, using the names of the members', async () => {
    setUp()
    const seen = recordRequests()
    const { user } = renderApp('/groups/g1/expenses')
    await screen.findByText('Groceries')

    await user.selectOptions(screen.getByLabelText('Paid by'), 'Ahmed B.')
    await waitFor(() => expect(seen.at(-1)).toMatchObject({ paidBy: 'u-ahmed' }))
    await user.selectOptions(screen.getByLabelText('Taking part'), 'Hamza K.')

    await waitFor(() => expect(seen.at(-1)).toMatchObject({ paidBy: 'u-ahmed', participant: 'u-hamza' }))
  })

  it('waits for a pause in the typing before it searches: three letters make one request', async () => {
    setUp()
    const seen = recordRequests()
    const { user } = renderApp('/groups/g1/expenses')
    await screen.findByText('Groceries')
    const before = seen.length

    await user.type(screen.getByLabelText('Search'), 'gro')

    await waitFor(() => expect(seen.at(-1)).toMatchObject({ q: 'gro' }))
    expect(seen.slice(before).filter((request) => 'q' in request)).toHaveLength(1)
  })

  it('opens with the filters of the address, so a filtered list can be shared', async () => {
    setUp()
    const seen = recordRequests()
    renderApp('/groups/g1/expenses?q=taxi&category=TRANSPORTATION&from=2026-10-01&to=2026-10-31&page=1')

    await screen.findByText('Groceries')

    expect(seen[0]).toEqual({ page: '1', size: '20', q: 'taxi', category: 'TRANSPORTATION', from: '2026-10-01', to: '2026-10-31' })
    expect(screen.getByLabelText('Search')).toHaveValue('taxi')
    expect(screen.getByLabelText('Category')).toHaveValue('TRANSPORTATION')
    expect(screen.getByLabelText('From')).toHaveValue('2026-10-01')
  })

  it('opens the plain list for a mangled address instead of failing', async () => {
    setUp()
    const seen = recordRequests()
    renderApp('/groups/g1/expenses?category=NOPE&from=2026-02-30&page=-4')

    await screen.findByText('Groceries')

    expect(seen[0]).toEqual({ page: '0', size: '20' })
  })

  it('does not ask the server for a period that ends before it starts', async () => {
    setUp()
    const seen = recordRequests()
    renderApp('/groups/g1/expenses?from=2026-11-01&to=2026-10-01')

    expect(await screen.findByText('The start date is after the end date.')).toBeInTheDocument()
    expect(seen).toHaveLength(0)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('pages through the results', async () => {
    setUp()
    const seen = recordRequests()
    const { user, router } = renderApp('/groups/g1/expenses')
    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument()
    expect(seen.at(-1)).toMatchObject({ page: '1' })
    expect(router.state.location.search).toBe('?page=1')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Page 3 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('clears every filter, the search box included', async () => {
    setUp()
    const seen = recordRequests()
    const { user, router } = renderApp('/groups/g1/expenses?q=taxi&category=RENT')
    await screen.findByText('Groceries')

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))

    await waitFor(() => expect(seen.at(-1)).toEqual({ page: '0', size: '20' }))
    expect(screen.getByLabelText('Search')).toHaveValue('')
    expect(screen.getByLabelText('Category')).toHaveValue('')
    expect(router.state.location.search).toBe('')
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  })

  it('opens an expense, and "back" returns to the same filtered list', async () => {
    setUp([expense({ id: 'e1', title: 'Groceries' })])
    server.use(http.get(`${API}/groups/g1/expenses/e1`, () => HttpResponse.json(expense({ id: 'e1' }))))
    server.use(http.get(`${API}/groups/g1/activity`, () => HttpResponse.json(pageOf([]))))
    const { user, router } = renderApp('/groups/g1/expenses?category=FOOD')

    await user.click(await screen.findByRole('link', { name: /Groceries/ }))
    expect(await screen.findByRole('heading', { name: 'Groceries', level: 2 })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/groups/g1/expenses/e1')

    await user.click(screen.getByRole('link', { name: /All expenses/ }))

    expect(await screen.findByLabelText('Category')).toHaveValue('FOOD')
    expect(router.state.location.search).toBe('?category=FOOD')
  })

  it('says what went wrong and lets the user try again', async () => {
    asSignedIn()
    groupIs(group({ id: 'g1' }))
    membersAre('g1')
    server.use(http.get(`${API}/groups/g1/expenses`, () => problem(500, 'INTERNAL_ERROR')))
    const { user } = renderApp('/groups/g1/expenses')

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
    expensesAre('g1', pageOf([expense({ title: 'Back online' })]))
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Back online')).toBeInTheDocument()
  })

  it('is a section of the group: the Expenses tab is the active one', async () => {
    setUp()
    renderApp('/groups/g1/expenses')

    const tabs = await screen.findByRole('navigation', { name: 'Group sections' })

    expect(within(tabs).getByRole('link', { name: 'Expenses' })).toHaveAttribute('aria-current', 'page')
    expect(within(tabs).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
  })

  it('speaks French', async () => {
    setUp()
    const { user } = renderApp('/groups/g1/expenses')
    await screen.findByText('Groceries')

    await user.selectOptions(screen.getByLabelText('Language'), 'fr')

    expect(await screen.findByLabelText('Rechercher')).toBeInTheDocument()
    const row = screen.getByText('Groceries').closest('li') as HTMLElement
    expect(within(row).getByText('Alimentation et courses')).toBeInTheDocument()
    expect(within(row).getByText('Payé par Youssef E.')).toBeInTheDocument()
  })
})
