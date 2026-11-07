import { screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, asSignedIn, emptySummary, group, groupIs, problem, reportsAre } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'
import { monthLabel } from '@/features/reports/chartData'
import type { ReportSummary } from '@/types/api'

const SUMMARY: ReportSummary = {
  currency: 'MAD',
  totalExpensesMinor: 110000,
  expenseCount: 4,
  memberCount: 3,
  activeMemberCount: 2,
  outstandingDebtsMinor: 25333,
  confirmedSettlementsMinor: 4000,
  pendingSettlementsMinor: 1500,
  pendingSettlementsCount: 2,
}

const plain = (text: string | null) => (text ?? '').replace(/[\s\u00a0\u202f]/g, ' ')

function withData() {
  asSignedIn()
  groupIs(group({ id: 'g1' }))
  reportsAre('g1', {
    summary: SUMMARY,
    monthly: {
      currency: 'MAD', from: '2026-09', to: '2026-11',
      months: [
        { month: '2026-09', totalMinor: 0, count: 0 },
        { month: '2026-10', totalMinor: 30000, count: 1 },
        { month: '2026-11', totalMinor: 80000, count: 3 },
      ],
    },
    categories: {
      currency: 'MAD', from: null, to: null, totalMinor: 110000,
      categories: [
        { category: 'RENT', totalMinor: 80000, count: 1, shareBp: 7273 },
        { category: 'FOOD', totalMinor: 30000, count: 3, shareBp: 2727 },
      ],
    },
    contributions: {
      currency: 'MAD', from: null, to: null,
      members: [
        { userId: 'u1', username: 'youssef', fullName: 'Youssef E.', paidMinor: 60000, shareMinor: 48334 },
        { userId: 'u2', username: 'ahmed', fullName: 'Ahmed B.', paidMinor: 10000, shareMinor: 35333 },
        { userId: 'u3', username: 'hamza', fullName: 'Hamza K.', paidMinor: 40000, shareMinor: 26333 },
      ],
    },
  })
}

describe('GroupDashboardPage', () => {
  it('shows the figures of the group, in its currency, with debts in red and settled money in green', async () => {
    withData()
    renderApp('/groups/g1')

    const total = (await screen.findByText('Total expenses')).closest('div') as HTMLElement
    expect(plain(within(total).getByText(/1,100\.00/).textContent)).toBe('MAD 1,100.00')

    const debts = screen.getByText('Outstanding debts').closest('div') as HTMLElement
    expect(within(debts).getByText(/253\.33/)).toHaveClass('text-debt')
    const settled = screen.getByText('Settled').closest('div') as HTMLElement
    expect(within(settled).getByText(/40\.00/)).toHaveClass('text-credit')

    expect(within(screen.getByText('Number of expenses').closest('div') as HTMLElement).getByText('4')).toBeInTheDocument()
    const members = screen.getByText('Members').closest('div') as HTMLElement
    expect(within(members).getByText('3')).toBeInTheDocument()
    expect(within(members).getByText('2 active')).toBeInTheDocument()
    expect(screen.getByText('Pending repayments: 2')).toBeInTheDocument()
  })

  it('gives every chart a table with the same figures, for people who cannot see the picture', async () => {
    withData()
    renderApp('/groups/g1')

    const monthly = await screen.findByRole('table', { name: 'Spending by month' })
    const monthRows = within(monthly).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((c) => plain(c.textContent)))
    // month names come from the locale data of the runtime (en-GB writes "Sept"), so compare with the formatter itself
    expect(monthRows).toEqual([
      [monthLabel('2026-09', 'en'), 'MAD 0.00', '0'],
      [monthLabel('2026-10', 'en'), 'MAD 300.00', '1'],
      [monthLabel('2026-11', 'en'), 'MAD 800.00', '3'],
    ])

    const categories = screen.getByRole('table', { name: 'Spending by category' })
    const categoryRows = within(categories).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((c) => plain(c.textContent)))
    expect(categoryRows).toEqual([['Rent', 'MAD 800.00', '72.7%'], ['Food & groceries', 'MAD 300.00', '27.3%']])

    const contributions = screen.getByRole('table', { name: 'Who paid, and each share' })
    const contributionRows = within(contributions).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((c) => plain(c.textContent)))
    expect(contributionRows[0]).toEqual(['Youssef E.', 'MAD 600.00', 'MAD 483.34'])
    expect(contributionRows[1]).toEqual(['Ahmed B.', 'MAD 100.00', 'MAD 353.33'])
  })

  it('draws each chart inside a container hidden from screen readers, whose table is their version', async () => {
    withData()
    renderApp('/groups/g1')

    for (const title of ['Spending by month', 'Spending by category', 'Who paid, and each share']) {
      await screen.findByRole('heading', { name: title })
      // the chart library is downloaded on demand, so the picture appears a moment after its card. Wait for it, and
      // look the card up again at every attempt: it may be rendered again while the chart loads
      await waitFor(() => {
        const card = screen.getByRole('heading', { name: title }).closest('figure')
        expect(card?.querySelector('[aria-hidden="true"] svg'), `no picture yet in "${title}"`).not.toBeNull()
      })
      const card = screen.getByRole('heading', { name: title }).closest('figure') as HTMLElement
      expect(within(card).getByRole('table', { name: title })).toBeInTheDocument()
    }
  })

  it('shows an invitation to add the first expense instead of empty charts', async () => {
    asSignedIn()
    groupIs(group({ id: 'g1' }))
    reportsAre('g1', { summary: { ...emptySummary, expenseCount: 0 } })
    renderApp('/groups/g1')

    expect(await screen.findByText('No expenses yet')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Spending by month' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Period')).not.toBeInTheDocument()
    expect(screen.getByText('About this group')).toBeInTheDocument()
  })

  it('says "nothing in this period" for a category chart without data', async () => {
    withData()
    reportsAre('g1', { summary: SUMMARY })
    renderApp('/groups/g1')

    expect(await screen.findByText('Nothing in this period.')).toBeInTheDocument()
  })

  it('a failing report does not blank the others, and can be retried on its own', async () => {
    withData()
    server.use(http.get(`${API}/groups/g1/reports/monthly`, () => problem(500, 'INTERNAL_ERROR')))
    const { user } = renderApp('/groups/g1')

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
    expect(screen.getByText('Total expenses')).toBeInTheDocument()
    expect(await screen.findByRole('table', { name: 'Spending by category' })).toBeInTheDocument()

    server.use(http.get(`${API}/groups/g1/reports/monthly`, () => HttpResponse.json({ currency: 'MAD', from: '2026-11', to: '2026-11', months: [{ month: '2026-11', totalMinor: 100, count: 1 }] })))
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('table', { name: 'Spending by month' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('asks the server for the period that is chosen, and nothing else changes in the summary', async () => {
    withData()
    const seen: Array<{ path: string; params: Record<string, string> }> = []
    for (const path of ['monthly', 'categories', 'contributions', 'summary']) {
      server.use(http.get(`${API}/groups/g1/reports/${path}`, ({ request }) => {
        seen.push({ path, params: Object.fromEntries(new URL(request.url).searchParams) })
        const body: Record<string, unknown> = {
          summary: SUMMARY,
          monthly: { currency: 'MAD', from: 'x', to: 'y', months: [] },
          categories: { currency: 'MAD', from: null, to: null, totalMinor: 0, categories: [] },
          contributions: { currency: 'MAD', from: null, to: null, members: [] },
        }
        return HttpResponse.json(body[path] as object)
      }))
    }
    const { user } = renderApp('/groups/g1')
    await screen.findByRole('table', { name: 'Spending by month' })
    expect(seen.filter((r) => r.path === 'categories')[0].params).toMatchObject({ from: expect.stringMatching(/^\d{4}-\d{2}-01$/), to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })

    await user.selectOptions(screen.getByLabelText('Period'), 'all')

    await within(document.body).findByRole('table', { name: 'Spending by category' })
    const lastCategories = seen.filter((r) => r.path === 'categories').at(-1)
    expect(lastCategories?.params).toEqual({})
    const lastMonthly = seen.filter((r) => r.path === 'monthly').at(-1)
    expect(lastMonthly?.params.from).toMatch(/^\d{4}-\d{2}$/)
    expect(seen.filter((r) => r.path === 'summary')).toHaveLength(1)
  })

  it('shows the details of the group below the figures', async () => {
    withData()
    renderApp('/groups/g1')

    expect(await screen.findByText('About this group')).toBeInTheDocument()
    expect(screen.getByText('MAD — Moroccan Dirham')).toBeInTheDocument()
  })

  it('speaks French and formats the amounts the French way', async () => {
    withData()
    const { user } = renderApp('/groups/g1')
    await screen.findByText('Total expenses')

    await user.selectOptions(screen.getByLabelText('Language'), 'fr')

    expect(await screen.findByText('Total des dépenses')).toBeInTheDocument()
    expect(plain(screen.getAllByText(/1.100,00/)[0].textContent)).toBe('1 100,00 MAD')
    expect(screen.getByRole('table', { name: 'Dépenses par catégorie' })).toBeInTheDocument()
    expect(within(screen.getByRole('table', { name: 'Dépenses par catégorie' })).getByText('Loyer')).toBeInTheDocument()
  })
})
