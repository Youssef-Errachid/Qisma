import { screen, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, activityIs, asSignedIn, expense, expensesAre, group, groupIs, membersAre, pageOf, problem } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'
import type { ActivityLine, ExpenseResponse } from '@/types/api'

function setUp(e: ExpenseResponse = expense(), groupOverrides = {}, lines: ActivityLine[] = []) {
  asSignedIn()
  groupIs(group({ id: 'g1', ...groupOverrides }))
  membersAre('g1')
  server.use(http.get(`${API}/groups/g1/expenses/${e.id}`, () => HttpResponse.json(e)))
  activityIs('g1', lines)
}

const line = (overrides: Partial<ActivityLine>): ActivityLine => ({
  id: 'a1', action: 'EXPENSE_CREATED', entityType: 'EXPENSE', entityId: 'e1', actorId: 'u-youssef', actorUsername: 'youssef',
  createdAt: '2026-11-03T18:00:00Z', oldValue: null, newValue: { amountMinor: 30000 }, ...overrides,
})

describe('ExpenseDetailPage', () => {
  it('shows the expense, who paid and what each member owes', async () => {
    setUp(expense({ title: 'Groceries', description: 'Weekly shop', paidBy: 'u-ahmed', createdBy: 'u-ahmed' }))
    renderApp('/groups/g1/expenses/e1')

    expect(await screen.findByRole('heading', { name: 'Groceries', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('Weekly shop')).toBeInTheDocument()
    expect(screen.getByText('Equal split')).toBeInTheDocument()
    expect(screen.getByText('Food & groceries')).toBeInTheDocument()

    const shares = screen.getByRole('table')
    const rows = within(shares).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    expect(within(rows[1]).getByText('Ahmed B.')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Paid')).toBeInTheDocument()   // Ahmed is the payer
    expect(within(rows[0]).queryByText('Paid')).not.toBeInTheDocument()
    expect(within(shares).queryByText('Percentage')).not.toBeInTheDocument()
  })

  it('shows the percentages of a percentage split', async () => {
    setUp(expense({
      splitMethod: 'PERCENTAGE', amountMinor: 40000,
      shares: [
        { userId: 'u-youssef', shareMinor: 20000, percentageBp: 5000 },
        { userId: 'u-ahmed', shareMinor: 12000, percentageBp: 3000 },
        { userId: 'u-hamza', shareMinor: 8000, percentageBp: 2000 },
      ],
    }))
    renderApp('/groups/g1/expenses/e1')

    const shares = await screen.findByRole('table')

    expect(within(shares).getByText('Percentage')).toBeInTheDocument()
    expect(within(shares).getByText('50.00%')).toBeInTheDocument()
    expect(within(shares).getByText('30.00%')).toBeInTheDocument()
    expect(within(shares).getByText('20.00%')).toBeInTheDocument()
  })

  it('shows the history of the expense with who did what and how the amount changed', async () => {
    setUp(expense(), {}, [
      line({ id: 'a2', action: 'EXPENSE_UPDATED', actorUsername: 'ahmed', oldValue: { amountMinor: 9000 }, newValue: { amountMinor: 12000 } }),
      line({ id: 'a1', action: 'EXPENSE_CREATED', actorUsername: 'youssef', oldValue: null, newValue: { amountMinor: 9000 } }),
    ])
    renderApp('/groups/g1/expenses/e1')

    expect(await screen.findByText('Expense changed')).toBeInTheDocument()
    expect(screen.getByText('Expense added')).toBeInTheDocument()
    expect(screen.getByText(/by ahmed/)).toBeInTheDocument()
    const changed = screen.getByText('Expense changed').closest('li') as HTMLElement
    expect((changed.textContent ?? '').replace(/[\s\u00a0\u202f]/g, ' ')).toContain('MAD 90.00 → MAD 120.00')
  })

  it('says there is no history rather than showing an empty box', async () => {
    setUp()
    renderApp('/groups/g1/expenses/e1')

    expect(await screen.findByText('No history.')).toBeInTheDocument()
  })

  it('lets the owner delete an expense somebody else added, after a confirmation', async () => {
    setUp(expense({ createdBy: 'u-ahmed' }), { myRole: 'OWNER' })
    let deleted = 0
    server.use(http.delete(`${API}/groups/g1/expenses/e1`, () => {
      deleted++
      return new HttpResponse(null, { status: 204 })
    }))
    expensesAre('g1', pageOf([]))
    const { user, router } = renderApp('/groups/g1/expenses/e1')

    await user.click(await screen.findByRole('button', { name: 'Delete expense' }))
    expect(screen.getByText('Delete this expense?')).toBeInTheDocument()
    expect(deleted).toBe(0)
    await user.click(screen.getByRole('button', { name: 'Yes, delete it' }))

    expect(await screen.findByText('The expense was deleted.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/groups/g1/expenses')
    expect(deleted).toBe(1)
  })

  it('lets the user change their mind', async () => {
    setUp(expense({ createdBy: 'u-youssef' }))
    let deleted = 0
    server.use(http.delete(`${API}/groups/g1/expenses/e1`, () => {
      deleted++
      return new HttpResponse(null, { status: 204 })
    }))
    const { user } = renderApp('/groups/g1/expenses/e1')

    await user.click(await screen.findByRole('button', { name: 'Delete expense' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText('Delete this expense?')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete expense' })).toBeInTheDocument()
    expect(deleted).toBe(0)
  })

  it('lets a member delete their own expense but not the expense of someone else', async () => {
    setUp(expense({ createdBy: 'u-youssef' }), { myRole: 'MEMBER' })
    const own = renderApp('/groups/g1/expenses/e1')
    expect(await screen.findByRole('button', { name: 'Delete expense' })).toBeInTheDocument()
    own.unmount()

    setUp(expense({ createdBy: 'u-ahmed' }), { myRole: 'MEMBER' })
    renderApp('/groups/g1/expenses/e1')
    await screen.findByRole('heading', { name: 'Groceries', level: 2 })

    expect(screen.queryByRole('button', { name: 'Delete expense' })).not.toBeInTheDocument()
  })

  it('shows no way to delete in an archived group, and says why', async () => {
    setUp(expense({ createdBy: 'u-youssef' }), { myRole: 'OWNER', status: 'ARCHIVED' })
    renderApp('/groups/g1/expenses/e1')

    expect(await screen.findByText('This group is archived: expenses can no longer be changed.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete expense' })).not.toBeInTheDocument()
  })

  it('explains a refusal from the server and stays on the expense', async () => {
    setUp(expense({ createdBy: 'u-youssef' }))
    server.use(http.delete(`${API}/groups/g1/expenses/e1`, () => problem(403, 'FORBIDDEN')))
    const { user, router } = renderApp('/groups/g1/expenses/e1')

    await user.click(await screen.findByRole('button', { name: 'Delete expense' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete it' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('You are not allowed to do this.')
    expect(router.state.location.pathname).toBe('/groups/g1/expenses/e1')
  })

  it('does not tell a missing expense from a deleted one', async () => {
    asSignedIn()
    groupIs(group({ id: 'g1' }))
    membersAre('g1')
    server.use(http.get(`${API}/groups/g1/expenses/gone`, () => problem(404, 'NOT_FOUND', 'Expense not found')))
    activityIs('g1', [])
    renderApp('/groups/g1/expenses/gone')

    expect(await screen.findByRole('heading', { name: 'Expense not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All expenses' })).toBeInTheDocument()
  })

  it('refreshes the figures of the group after a deletion: the dashboard must not show the old total', async () => {
    setUp(expense({ createdBy: 'u-youssef' }))
    server.use(http.delete(`${API}/groups/g1/expenses/e1`, () => new HttpResponse(null, { status: 204 })))
    expensesAre('g1', pageOf([]))
    let summaryCalls = 0
    server.use(http.get(`${API}/groups/g1/reports/summary`, () => {
      summaryCalls++
      return HttpResponse.json({ currency: 'MAD', totalExpensesMinor: 0, expenseCount: 0, memberCount: 3, activeMemberCount: 3, outstandingDebtsMinor: 0, confirmedSettlementsMinor: 0, pendingSettlementsMinor: 0, pendingSettlementsCount: 0 })
    }))
    const { user, router } = renderApp('/groups/g1')
    await screen.findByText('No expenses yet')
    expect(summaryCalls).toBe(1)
    await router.navigate('/groups/g1/expenses/e1')

    await user.click(await screen.findByRole('button', { name: 'Delete expense' }))
    await user.click(screen.getByRole('button', { name: 'Yes, delete it' }))
    await screen.findByText('The expense was deleted.')
    await user.click(screen.getByRole('link', { name: 'Dashboard' }))

    await screen.findByText('Total expenses')
    expect(summaryCalls).toBeGreaterThan(1)
  })
})
