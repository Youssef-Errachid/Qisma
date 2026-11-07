import { screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, asSignedIn, group, groupIs, groupsAre, problem } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'

describe('CreateGroupPage', () => {
  it('starts with the Moroccan dirham selected and shows the currencies in the language of the user', async () => {
    asSignedIn()
    renderApp('/groups/new')

    const select = (await screen.findByLabelText('Currency')) as HTMLSelectElement
    expect(select.value).toBe('MAD')
    expect(screen.getByRole('option', { name: 'MAD — Moroccan Dirham' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'EUR — Euro' })).toBeInTheDocument()
  })

  it('asks for a name before calling the server', async () => {
    asSignedIn()
    let calls = 0
    server.use(http.post(`${API}/groups`, () => {
      calls++
      return HttpResponse.json(group(), { status: 201 })
    }))
    const { user } = renderApp('/groups/new')

    await user.click(await screen.findByRole('button', { name: 'Create group' }))

    expect(await screen.findByText('This field is required')).toBeInTheDocument()
    expect(calls).toBe(0)
  })

  it('creates the group with what was typed and opens it', async () => {
    asSignedIn()
    let body: unknown = null
    const created = group({ id: 'g-new', name: 'Trip to Essaouira', currency: 'EUR', description: 'Summer trip' })
    server.use(http.post(`${API}/groups`, async ({ request }) => {
      body = await request.json()
      return HttpResponse.json(created, { status: 201 })
    }))
    groupIs(created)
    groupsAre([created])
    const { user, router } = renderApp('/groups/new')

    await user.type(await screen.findByLabelText('Group name'), '  Trip to Essaouira ')
    await user.type(screen.getByLabelText('Description (optional)'), 'Summer trip')
    await user.selectOptions(screen.getByLabelText('Currency'), 'EUR')
    await user.click(screen.getByRole('button', { name: 'Create group' }))

    expect(await screen.findByRole('heading', { name: 'Trip to Essaouira', level: 1 })).toBeInTheDocument()
    expect(body).toEqual({ name: 'Trip to Essaouira', description: 'Summer trip', currency: 'EUR' })
    expect(router.state.location.pathname).toBe('/groups/g-new')
  })

  it('does not send an empty description', async () => {
    asSignedIn()
    let body: Record<string, unknown> | null = null
    const created = group({ id: 'g-new', name: 'Flat' })
    server.use(http.post(`${API}/groups`, async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>
      return HttpResponse.json(created, { status: 201 })
    }))
    groupIs(created)
    const { user } = renderApp('/groups/new')

    await user.type(await screen.findByLabelText('Group name'), 'Flat')
    await user.click(screen.getByRole('button', { name: 'Create group' }))

    await screen.findByRole('heading', { name: 'Flat', level: 1 })
    expect(body).toEqual({ name: 'Flat', currency: 'MAD' })
  })

  it('explains when the limit of groups is reached', async () => {
    asSignedIn()
    server.use(http.post(`${API}/groups`, () => problem(422, 'LIMIT_REACHED')))
    const { user } = renderApp('/groups/new')

    await user.type(await screen.findByLabelText('Group name'), 'One too many')
    await user.click(screen.getByRole('button', { name: 'Create group' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('maximum number of groups')
  })

  it('shows a server field error on its field', async () => {
    asSignedIn()
    server.use(http.post(`${API}/groups`, () =>
      problem(400, 'VALIDATION_FAILED', 'Validation failed', [{ field: 'name', message: 'size must be between 1 and 80' }])))
    const { user } = renderApp('/groups/new')

    await user.type(await screen.findByLabelText('Group name'), 'Flat')
    await user.click(screen.getByRole('button', { name: 'Create group' }))

    expect(await screen.findByText('size must be between 1 and 80')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('goes back to the list without creating anything', async () => {
    asSignedIn()
    groupsAre([])
    const { user } = renderApp('/groups/new')

    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(await screen.findByRole('heading', { name: 'Your groups' })).toBeInTheDocument()
  })
})
