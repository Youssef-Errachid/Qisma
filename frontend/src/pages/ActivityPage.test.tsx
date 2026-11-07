import { screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, activityLine, asSignedIn, group, groupIs, membersAre, pageOf, problem } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'
import type { ActivityLine } from '@/types/api'

function setUp(lines: ActivityLine[] = [activityLine()], extra: { totalElements?: number; totalPages?: number } = {}) {
  asSignedIn()
  groupIs(group({ id: 'g1' }))
  membersAre('g1')
  const seen: Array<Record<string, string>> = []
  server.use(http.get(`${API}/groups/g1/activity`, ({ request }) => {
    const params = new URL(request.url).searchParams
    seen.push(Object.fromEntries(params))
    return HttpResponse.json(pageOf(lines, { page: Number(params.get('page') ?? 0), ...extra }))
  }))
  return seen
}

describe('ActivityPage', () => {
  it('lists what happened, who did it (by name) and when', async () => {
    setUp([
      activityLine({ id: 'a1', action: 'EXPENSE_CREATED', actorId: 'u-ahmed', actorUsername: 'ahmed' }),
      activityLine({ id: 'a2', action: 'SETTLEMENT_CONFIRMED', entityType: 'SETTLEMENT', entityId: 's1', actorId: 'u-youssef', actorUsername: 'youssef', newValue: null }),
    ])
    renderApp('/groups/g1/activity')

    const items = await screen.findAllByRole('listitem')

    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain('Expense added')
    expect(items[0].textContent).toContain('by Ahmed B.')
    expect(items[1].textContent).toContain('Repayment confirmed')
    expect(items[1].textContent).toContain('by Youssef E.')
  })

  it('opens what a line is about, and offers nothing for a deleted expense', async () => {
    setUp([
      activityLine({ id: 'a1', action: 'EXPENSE_UPDATED', entityId: 'e7' }),
      activityLine({ id: 'a2', action: 'EXPENSE_DELETED', entityId: 'e8' }),
      activityLine({ id: 'a3', action: 'SETTLEMENT_CREATED', entityType: 'SETTLEMENT', entityId: 's1' }),
    ])
    renderApp('/groups/g1/activity')

    expect(await screen.findByRole('link', { name: 'Expense changed' })).toHaveAttribute('href', '/groups/g1/expenses/e7')
    expect(screen.getByRole('link', { name: 'Repayment declared' })).toHaveAttribute('href', '/groups/g1/settlements')
    // the name of an action is also an option of the filter: look in the history itself
    const deleted = screen.getAllByRole('listitem').find((item) => item.textContent?.includes('Expense deleted')) as HTMLElement
    expect(within(deleted).queryByRole('link')).not.toBeInTheDocument()
  })

  it('asks for the first page of 20, with no filter', async () => {
    const seen = setUp()
    renderApp('/groups/g1/activity')

    await screen.findByText('Expense added')

    expect(seen[0]).toEqual({ page: '0', size: '20' })
  })

  it('filters by what happened and by who did it, and writes it in the address', async () => {
    const seen = setUp()
    const { user, router } = renderApp('/groups/g1/activity')
    await screen.findByText('Expense added')

    await user.selectOptions(screen.getByLabelText('What happened'), 'Expense deleted')
    await waitFor(() => expect(seen.at(-1)).toMatchObject({ action: 'EXPENSE_DELETED', page: '0' }))
    await user.selectOptions(screen.getByLabelText('Who did it'), 'Ahmed B.')

    await waitFor(() => expect(seen.at(-1)).toMatchObject({ action: 'EXPENSE_DELETED', actorId: 'u-ahmed' }))
    expect(router.state.location.search).toBe('?action=EXPENSE_DELETED&actorId=u-ahmed')
  })

  it('opens with the filters of the address, and ignores what is mangled', async () => {
    const seen = setUp()
    renderApp('/groups/g1/activity?action=NOPE&from=2026-10-01&to=2026-10-31&page=1')

    await screen.findByText('Expense added')

    expect(seen[0]).toEqual({ page: '1', size: '20', from: '2026-10-01', to: '2026-10-31' })
    expect(screen.getByLabelText('From')).toHaveValue('2026-10-01')
  })

  it('does not ask the server for a period that ends before it starts', async () => {
    const seen = setUp()
    renderApp('/groups/g1/activity?from=2026-11-01&to=2026-10-01')

    expect(await screen.findByText('The start date is after the end date.')).toBeInTheDocument()
    expect(seen).toHaveLength(0)
  })

  it('pages through a long history', async () => {
    const seen = setUp([activityLine()], { totalElements: 45, totalPages: 3 })
    const { user } = renderApp('/groups/g1/activity')

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument()
    expect(seen.at(-1)).toMatchObject({ page: '1' })
  })

  it('says nothing happened yet, or that nothing matches, and clears the filters', async () => {
    setUp([], { totalElements: 0, totalPages: 0 })
    const empty = renderApp('/groups/g1/activity')
    expect(await screen.findByText('Nothing has happened in this group yet')).toBeInTheDocument()
    empty.unmount()

    setUp([], { totalElements: 0, totalPages: 0 })
    const { user, router } = renderApp('/groups/g1/activity?action=GROUP_UPDATED')
    expect(await screen.findByText('Nothing matches these filters')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(router.state.location.search).toBe(''))
  })

  it('says what went wrong and lets the user try again', async () => {
    asSignedIn()
    groupIs(group({ id: 'g1' }))
    membersAre('g1')
    server.use(http.get(`${API}/groups/g1/activity`, () => problem(500, 'INTERNAL_ERROR')))
    const { user } = renderApp('/groups/g1/activity')

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
    server.use(http.get(`${API}/groups/g1/activity`, () => HttpResponse.json(pageOf([activityLine({ action: 'GROUP_UPDATED', entityType: 'GROUP', entityId: 'g1' })]))))
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Group updated' })).toHaveAttribute('href', '/groups/g1/settings')
  })

  it('is a section of the group, and follows what is done in the group', async () => {
    setUp()
    renderApp('/groups/g1/activity')

    const tabs = await screen.findByRole('navigation', { name: 'Group sections' })

    expect(within(tabs).getByRole('link', { name: 'Activity' })).toHaveAttribute('aria-current', 'page')
  })
})
