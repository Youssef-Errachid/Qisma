import { screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, FRIENDS, activityIs, asSignedIn, expense, expensesAre, group, groupIs, member, membersAre, pageOf, problem } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'
import type { ExpenseResponse } from '@/types/api'

type Body = Record<string, unknown>
const plain = (text: string | null) => (text ?? '').replace(/[\s\u00a0\u202f]/g, ' ')

/** The group, its members, and an endpoint that records what is sent when an expense is added. */
function forCreate(groupOverrides = {}, members = FRIENDS) {
  asSignedIn()
  groupIs(group({ id: 'g1', ...groupOverrides }))
  membersAre('g1', members)
  const sent: { body: Body | null; calls: number } = { body: null, calls: 0 }
  server.use(http.post(`${API}/groups/g1/expenses`, async ({ request }) => {
    sent.calls++
    sent.body = (await request.json()) as Body
    return HttpResponse.json(expense({ id: 'e-new', title: String(sent.body.title) }), { status: 201 })
  }))
  server.use(http.get(`${API}/groups/g1/expenses/e-new`, () => HttpResponse.json(expense({ id: 'e-new', title: 'Groceries' }))))
  activityIs('g1', [])
  return sent
}

async function fillBasics(user: ReturnType<typeof renderApp>['user'], title = 'Groceries', amount = '100') {
  await user.type(await screen.findByLabelText('Title'), title)
  await user.type(screen.getByLabelText('Amount (MAD)'), amount)
}

const shareText = (name: string) => plain(screen.getByLabelText(`Share of ${name}`).textContent)

describe('adding an expense: an equal split', () => {
  it('previews the shares as the server will store them, and sends the people without any amount', async () => {
    const sent = forCreate()
    const { user, router } = renderApp('/groups/g1/expenses/new')

    await fillBasics(user)

    expect(shareText('Youssef E.')).toBe('MAD 33.34')
    expect(shareText('Ahmed B.')).toBe('MAD 33.33')
    expect(shareText('Hamza K.')).toBe('MAD 33.33')
    await user.click(screen.getByRole('button', { name: 'Add expense' }))

    expect(await screen.findByRole('heading', { name: 'Groceries', level: 2 })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/groups/g1/expenses/e-new')
    expect(sent.body).toEqual({
      title: 'Groceries', amountMinor: 10000, paidBy: 'u-youssef', expenseDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      category: 'FOOD', splitMethod: 'EQUAL', participants: [{ userId: 'u-youssef' }, { userId: 'u-ahmed' }, { userId: 'u-hamza' }],
    })
  })

  it('updates the preview as the amount and the participants change', async () => {
    forCreate()
    const { user } = renderApp('/groups/g1/expenses/new')
    await fillBasics(user, 'Taxi', '100.01')

    expect([shareText('Youssef E.'), shareText('Ahmed B.'), shareText('Hamza K.')]).toEqual(['MAD 33.34', 'MAD 33.34', 'MAD 33.33'])
    await user.click(screen.getByRole('checkbox', { name: 'Hamza K.' }))

    expect(shareText('Youssef E.')).toBe('MAD 50.01')
    expect(shareText('Ahmed B.')).toBe('MAD 50.00')
    expect(screen.getByLabelText('Share of Hamza K.')).toHaveTextContent('—')
  })

  it('lets someone pay who takes no part in the expense', async () => {
    const sent = forCreate()
    const { user } = renderApp('/groups/g1/expenses/new')
    await fillBasics(user, 'Gift', '60')

    await user.selectOptions(screen.getByLabelText('Paid by'), 'Ahmed B.')
    await user.click(screen.getByRole('checkbox', { name: 'Ahmed B.' }))
    await user.click(screen.getByRole('button', { name: 'Add expense' }))

    await screen.findByRole('heading', { name: 'Groceries', level: 2 })
    expect(sent.body).toMatchObject({ paidBy: 'u-ahmed', participants: [{ userId: 'u-youssef' }, { userId: 'u-hamza' }] })
  })

  it('offers only the active members: someone who left can neither pay nor take part', async () => {
    forCreate({}, [...FRIENDS, member({ userId: 'u-old', username: 'old', fullName: 'Old Friend', role: 'MEMBER', status: 'INACTIVE' })])
    renderApp('/groups/g1/expenses/new')

    await screen.findByLabelText('Title')

    expect(screen.queryByRole('checkbox', { name: 'Old Friend' })).not.toBeInTheDocument()
    expect(within(screen.getByLabelText('Paid by')).queryByRole('option', { name: 'Old Friend' })).not.toBeInTheDocument()
  })
})

describe('adding an expense: custom amounts', () => {
  it('starts from the equal split, shows what is left to allocate, and sends the amounts once they add up', async () => {
    const sent = forCreate()
    const { user } = renderApp('/groups/g1/expenses/new')
    await fillBasics(user)

    await user.click(screen.getByRole('radio', { name: 'Custom amounts' }))
    expect(screen.getByLabelText('Amount for Youssef E.')).toHaveValue('33.34')
    expect(screen.getByText('The amounts add up to the total.')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Amount for Youssef E.'))
    await user.type(screen.getByLabelText('Amount for Youssef E.'), '50')
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Too much by MAD 16.66')
    await user.click(screen.getByRole('button', { name: 'Add expense' }))
    expect(sent.calls).toBe(0)

    await user.clear(screen.getByLabelText('Amount for Hamza K.'))
    await user.type(screen.getByLabelText('Amount for Hamza K.'), '16.67')
    expect(screen.getByText('The amounts add up to the total.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add expense' }))

    await screen.findByRole('heading', { name: 'Groceries', level: 2 })
    expect(sent.body).toMatchObject({
      splitMethod: 'CUSTOM',
      participants: [{ userId: 'u-youssef', shareMinor: 5000 }, { userId: 'u-ahmed', shareMinor: 3333 }, { userId: 'u-hamza', shareMinor: 1667 }],
    })
  })

  it('does not send until every amount is there and valid, and shows which box is wrong', async () => {
    const sent = forCreate()
    const { user } = renderApp('/groups/g1/expenses/new')
    await fillBasics(user)
    await user.click(screen.getByRole('radio', { name: 'Custom amounts' }))
    await user.clear(screen.getByLabelText('Amount for Ahmed B.'))
    await user.type(screen.getByLabelText('Amount for Hamza K.'), 'x')

    await user.click(screen.getByRole('button', { name: 'Add expense' }))

    expect(await screen.findByText('Required')).toBeInTheDocument()
    expect(screen.getByLabelText('Amount for Ahmed B.')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Amount for Hamza K.')).toHaveAttribute('aria-invalid', 'true')
    expect(sent.calls).toBe(0)
  })

  it('"Split equally" refills the boxes after the amount changes', async () => {
    forCreate()
    const { user } = renderApp('/groups/g1/expenses/new')
    await fillBasics(user, 'Rent', '90')
    await user.click(screen.getByRole('radio', { name: 'Custom amounts' }))
    await user.clear(screen.getByLabelText('Amount (MAD)'))
    await user.type(screen.getByLabelText('Amount (MAD)'), '120')
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Still to allocate: MAD 30.00')

    await user.click(screen.getByRole('button', { name: 'Split equally' }))

    expect(screen.getByLabelText('Amount for Youssef E.')).toHaveValue('40.00')
    expect(screen.getByText('The amounts add up to the total.')).toBeInTheDocument()
  })
})

describe('adding an expense: percentages', () => {
  it('sends the percentages, not the amounts, and the preview is the share of each', async () => {
    const sent = forCreate()
    const { user } = renderApp('/groups/g1/expenses/new')
    await fillBasics(user, 'Dinner', '400')

    await user.click(screen.getByRole('radio', { name: 'Percentages' }))
    expect(screen.getByLabelText('Percentage for Youssef E.')).toHaveValue('33.34')
    for (const [name, value] of [['Youssef E.', '50'], ['Ahmed B.', '30'], ['Hamza K.', '20']]) {
      await user.clear(screen.getByLabelText(`Percentage for ${name}`))
      await user.type(screen.getByLabelText(`Percentage for ${name}`), value)
    }

    expect([shareText('Youssef E.'), shareText('Ahmed B.'), shareText('Hamza K.')]).toEqual(['MAD 200.00', 'MAD 120.00', 'MAD 80.00'])
    await user.click(screen.getByRole('button', { name: 'Add expense' }))

    await screen.findByRole('heading', { name: 'Groceries', level: 2 })
    expect(sent.body).toMatchObject({
      splitMethod: 'PERCENTAGE', amountMinor: 40000,
      participants: [{ userId: 'u-youssef', percentageBp: 5000 }, { userId: 'u-ahmed', percentageBp: 3000 }, { userId: 'u-hamza', percentageBp: 2000 }],
    })
    expect((sent.body?.participants as Body[]).every((p) => !('shareMinor' in p))).toBe(true)
  })

  it('says how many percent are missing, and does not send', async () => {
    const sent = forCreate()
    const { user } = renderApp('/groups/g1/expenses/new')
    await fillBasics(user, 'Dinner', '400')
    await user.click(screen.getByRole('radio', { name: 'Percentages' }))
    for (const [name, value] of [['Youssef E.', '50'], ['Ahmed B.', '30'], ['Hamza K.', '10']]) {
      await user.clear(screen.getByLabelText(`Percentage for ${name}`))
      await user.type(screen.getByLabelText(`Percentage for ${name}`), value)
    }

    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('10.00% still missing to reach 100%.')
    await user.click(screen.getByRole('button', { name: 'Add expense' }))

    expect(sent.calls).toBe(0)
  })

  it('gives the leftover centime to the biggest remainder, like the server', async () => {
    forCreate()
    const { user } = renderApp('/groups/g1/expenses/new')
    await fillBasics(user, 'Odd', '100.01')
    await user.click(screen.getByRole('radio', { name: 'Percentages' }))
    for (const [name, value] of [['Youssef E.', '33.33'], ['Ahmed B.', '33.33'], ['Hamza K.', '33.34']]) {
      await user.clear(screen.getByLabelText(`Percentage for ${name}`))
      await user.type(screen.getByLabelText(`Percentage for ${name}`), value)
    }

    expect([shareText('Youssef E.'), shareText('Ahmed B.'), shareText('Hamza K.')]).toEqual(['MAD 33.33', 'MAD 33.33', 'MAD 33.35'])
  })
})

describe('adding an expense: what is checked before anything is sent', () => {
  it('asks for a title and an amount', async () => {
    const sent = forCreate()
    const { user } = renderApp('/groups/g1/expenses/new')

    await user.click(await screen.findByRole('button', { name: 'Add expense' }))

    expect(await screen.findAllByText('This field is required')).toHaveLength(2)
    expect(sent.calls).toBe(0)
  })

  it('refuses an amount that is not an amount', async () => {
    const sent = forCreate()
    const { user } = renderApp('/groups/g1/expenses/new')
    await fillBasics(user, 'Odd', '12.345')

    await user.click(screen.getByRole('button', { name: 'Add expense' }))

    expect(await screen.findByText('Enter an amount like 120 or 120.50')).toBeInTheDocument()
    expect(sent.calls).toBe(0)
  })

  it('needs at least one person', async () => {
    const sent = forCreate()
    const { user } = renderApp('/groups/g1/expenses/new')
    await fillBasics(user)
    await user.click(screen.getByRole('button', { name: 'Nobody' }))

    await user.click(screen.getByRole('button', { name: 'Add expense' }))

    expect(await screen.findByText('Choose at least one person.')).toBeInTheDocument()
    expect(sent.calls).toBe(0)
  })

  it('accepts a comma as the decimal separator, as the French write it', async () => {
    const sent = forCreate()
    const { user } = renderApp('/groups/g1/expenses/new')
    await fillBasics(user, 'Pain', '12,50')

    await user.click(screen.getByRole('button', { name: 'Add expense' }))

    await screen.findByRole('heading', { name: 'Groceries', level: 2 })
    expect(sent.body).toMatchObject({ amountMinor: 1250 })
  })
})

describe('adding an expense: when the server refuses', () => {
  it('explains a split that does not add up and stays on the form', async () => {
    forCreate()
    server.use(http.post(`${API}/groups/g1/expenses`, () => problem(422, 'INVALID_SPLIT', 'Shares must sum')))
    const { user, router } = renderApp('/groups/g1/expenses/new')
    await fillBasics(user)

    await user.click(screen.getByRole('button', { name: 'Add expense' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The shares do not add up to the amount of the expense.')
    expect(router.state.location.pathname).toBe('/groups/g1/expenses/new')
    expect(screen.getByLabelText('Title')).toHaveValue('Groceries')
  })

  it('shows a server field error on its field', async () => {
    forCreate()
    server.use(http.post(`${API}/groups/g1/expenses`, () =>
      problem(400, 'VALIDATION_FAILED', 'Validation failed', [{ field: 'title', message: 'size must be between 1 and 120' }])))
    const { user } = renderApp('/groups/g1/expenses/new')
    await fillBasics(user)

    await user.click(screen.getByRole('button', { name: 'Add expense' }))

    expect(await screen.findByText('size must be between 1 and 120')).toBeInTheDocument()
  })
})

describe('who can open the form', () => {
  it('is closed in an archived group', async () => {
    forCreate({ status: 'ARCHIVED' })
    renderApp('/groups/g1/expenses/new')

    expect(await screen.findByText('This group is archived: no expense can be added or changed.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
  })

  it('is closed to a member who left, even though they can still read', async () => {
    forCreate({}, [member({ userId: 'u-youssef', status: 'INACTIVE' }), ...FRIENDS.slice(1)])
    renderApp('/groups/g1/expenses/new')

    expect(await screen.findByText('You are no longer an active member of this group, so you cannot add expenses.')).toBeInTheDocument()
  })

  it('shows the add button to an active member only', async () => {
    forCreate()
    expensesAre('g1', pageOf([]))
    const active = renderApp('/groups/g1/expenses')
    expect(await screen.findByRole('link', { name: 'Add expense' })).toHaveAttribute('href', '/groups/g1/expenses/new')
    active.unmount()

    forCreate({ status: 'ARCHIVED' })
    expensesAre('g1', pageOf([]))
    renderApp('/groups/g1/expenses')
    await screen.findByText('No expenses yet')
    expect(screen.queryByRole('link', { name: 'Add expense' })).not.toBeInTheDocument()
  })
})

describe('editing an expense', () => {
  function forEdit(e: ExpenseResponse = expense({ id: 'e1', version: 3, title: 'Groceries', amountMinor: 30000, description: 'Weekly shop' }), groupOverrides = {}, members = FRIENDS) {
    asSignedIn()
    groupIs(group({ id: 'g1', ...groupOverrides }))
    membersAre('g1', members)
    server.use(http.get(`${API}/groups/g1/expenses/e1`, () => HttpResponse.json(e)))
    activityIs('g1', [])
    const sent: { body: Body | null; calls: number } = { body: null, calls: 0 }
    server.use(http.put(`${API}/groups/g1/expenses/e1`, async ({ request }) => {
      sent.calls++
      sent.body = (await request.json()) as Body
      return HttpResponse.json({ ...e, title: String(sent.body.title), version: e.version + 1 })
    }))
    return sent
  }

  it('starts from the expense as it is', async () => {
    forEdit()
    renderApp('/groups/g1/expenses/e1/edit')

    expect(await screen.findByLabelText('Title')).toHaveValue('Groceries')
    expect(screen.getByLabelText('Description (optional)')).toHaveValue('Weekly shop')
    expect(screen.getByLabelText('Amount (MAD)')).toHaveValue('300.00')
    expect(screen.getByLabelText('Date')).toHaveValue('2026-11-03')
    expect(screen.getByLabelText('Category')).toHaveValue('FOOD')
    expect(screen.getByLabelText('Paid by')).toHaveValue('u-youssef')
    expect(screen.getByRole('radio', { name: 'Equally' })).toBeChecked()
    for (const name of ['Youssef E.', 'Ahmed B.', 'Hamza K.']) expect(screen.getByRole('checkbox', { name })).toBeChecked()
  })

  it('sends the whole expense with the version it was looking at', async () => {
    const sent = forEdit()
    const { user, router } = renderApp('/groups/g1/expenses/e1/edit')
    await user.clear(await screen.findByLabelText('Title'))
    await user.type(screen.getByLabelText('Title'), 'Groceries and fruit')
    await user.clear(screen.getByLabelText('Amount (MAD)'))
    await user.type(screen.getByLabelText('Amount (MAD)'), '345.50')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/groups/g1/expenses/e1'))
    expect(sent.body).toMatchObject({
      version: 3, title: 'Groceries and fruit', amountMinor: 34550, description: 'Weekly shop', splitMethod: 'EQUAL',
      participants: [{ userId: 'u-youssef' }, { userId: 'u-ahmed' }, { userId: 'u-hamza' }],
    })
  })

  it('starts a custom split from its amounts, and editing nothing changes nothing', async () => {
    const sent = forEdit(expense({
      id: 'e1', version: 0, splitMethod: 'CUSTOM', amountMinor: 30000,
      shares: [{ userId: 'u-youssef', shareMinor: 15000, percentageBp: null }, { userId: 'u-ahmed', shareMinor: 10000, percentageBp: null }, { userId: 'u-hamza', shareMinor: 5000, percentageBp: null }],
    }))
    const { user } = renderApp('/groups/g1/expenses/e1/edit')

    expect(await screen.findByLabelText('Amount for Youssef E.')).toHaveValue('150.00')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    // let the move to the expense page finish, so that none of its requests arrives after the test is over
    await screen.findByRole('heading', { name: 'Groceries', level: 2 })
    expect(sent.calls).toBe(1)
    expect(sent.body).toMatchObject({
      splitMethod: 'CUSTOM', amountMinor: 30000,
      participants: [{ userId: 'u-youssef', shareMinor: 15000 }, { userId: 'u-ahmed', shareMinor: 10000 }, { userId: 'u-hamza', shareMinor: 5000 }],
    })
  })

  it('says someone else saved first, and loads their version instead of overwriting it', async () => {
    forEdit(expense({ id: 'e1', version: 3, title: 'Mine' }))
    let latest = expense({ id: 'e1', version: 4, title: 'Changed by Ahmed' })
    server.use(http.put(`${API}/groups/g1/expenses/e1`, () => problem(409, 'VERSION_CONFLICT')))
    server.use(http.get(`${API}/groups/g1/expenses/e1`, () => HttpResponse.json(latest)))
    const { user } = renderApp('/groups/g1/expenses/e1/edit')
    await screen.findByLabelText('Title')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(/Someone changed this expense while you were editing it/)).toBeInTheDocument()

    latest = expense({ id: 'e1', version: 4, title: 'Changed by Ahmed' })
    await user.click(screen.getByRole('button', { name: 'Load the latest version' }))

    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Changed by Ahmed'))
    expect(screen.queryByText(/Someone changed this expense/)).not.toBeInTheDocument()
  })

  it('warns about a participant who has left, and leaves them out of the split', async () => {
    const sent = forEdit(
      expense({ id: 'e1', version: 0, amountMinor: 30000, shares: [
        { userId: 'u-youssef', shareMinor: 10000, percentageBp: null }, { userId: 'u-ahmed', shareMinor: 10000, percentageBp: null }, { userId: 'u-old', shareMinor: 10000, percentageBp: null },
      ] }),
      {}, [...FRIENDS, member({ userId: 'u-old', username: 'old', fullName: 'Old Friend', role: 'MEMBER', status: 'INACTIVE' })],
    )
    const { user } = renderApp('/groups/g1/expenses/e1/edit')

    expect(await screen.findByText(/No longer in the group, and left out of the split: Old Friend/)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Old Friend' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await screen.findByRole('heading', { name: 'Groceries', level: 2 })
    expect(sent.calls).toBe(1)
    expect(sent.body?.participants).toEqual([{ userId: 'u-youssef' }, { userId: 'u-ahmed' }])
  })

  it('makes the user choose again when the person who paid has left', async () => {
    const sent = forEdit(
      expense({ id: 'e1', version: 0, paidBy: 'u-old' }), {},
      [...FRIENDS, member({ userId: 'u-old', username: 'old', fullName: 'Old Friend', role: 'MEMBER', status: 'INACTIVE' })],
    )
    const { user } = renderApp('/groups/g1/expenses/e1/edit')

    expect(await screen.findByText('The person who paid is no longer an active member. Choose who paid.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('This field is required')).toBeInTheDocument()
    expect(sent.calls).toBe(0)
  })

  it('is closed to a member who did not add the expense, but open to the owner', async () => {
    forEdit(expense({ id: 'e1', createdBy: 'u-ahmed' }), { myRole: 'MEMBER' })
    const member1 = renderApp('/groups/g1/expenses/e1/edit')
    expect(await screen.findByText('Only the person who added this expense, or the owner of the group, can change it.')).toBeInTheDocument()
    member1.unmount()

    forEdit(expense({ id: 'e1', createdBy: 'u-ahmed' }), { myRole: 'OWNER' })
    renderApp('/groups/g1/expenses/e1/edit')
    expect(await screen.findByLabelText('Title')).toBeInTheDocument()
  })

  it('is reached from the detail page', async () => {
    forEdit()
    const { user, router } = renderApp('/groups/g1/expenses/e1')

    await user.click(await screen.findByRole('link', { name: 'Edit expense' }))

    expect(await screen.findByRole('heading', { name: 'Edit expense', level: 2 })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/groups/g1/expenses/e1/edit')
  })

  it('says an expense that does not exist does not exist', async () => {
    asSignedIn()
    groupIs(group({ id: 'g1' }))
    membersAre('g1')
    server.use(http.get(`${API}/groups/g1/expenses/gone`, () => problem(404, 'NOT_FOUND')))
    renderApp('/groups/g1/expenses/gone/edit')

    expect(await screen.findByText('It does not exist, or it was deleted.')).toBeInTheDocument()
  })
})

describe('the form in French', () => {
  it('speaks French, writes the decimal comma and reads it back', async () => {
    forCreate()
    const { user } = renderApp('/groups/g1/expenses/new')
    await screen.findByLabelText('Title')

    await user.selectOptions(screen.getByLabelText('Language'), 'fr')

    expect(await screen.findByLabelText('Titre')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'À parts égales' })).toBeChecked()
    await user.type(screen.getByLabelText('Montant (MAD)'), '100,01')
    expect(plain(screen.getByLabelText('Part de Youssef E.').textContent)).toBe('33,34 MAD')
  })
})
