import { screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, asSignedIn, group, groupIs, groupsAre, problem, reportsAre } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'

describe('GroupLayout and the overview', () => {
  it('shows the group, the role of the user and what is known about it', async () => {
    asSignedIn()
    groupIs(group({ id: 'g1', name: 'House 2026', description: 'Shared flat', currency: 'MAD', myRole: 'MEMBER' }))
    renderApp('/groups/g1')

    expect(await screen.findByRole('heading', { name: 'House 2026', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Shared flat')).toBeInTheDocument()
    expect(screen.getByText('MAD — Moroccan Dirham')).toBeInTheDocument()
    expect(screen.getAllByText('Member').length).toBeGreaterThan(0)
    expect(screen.getByText('5 Nov 2026')).toBeInTheDocument()
  })

  it('marks an archived group', async () => {
    asSignedIn()
    groupIs(group({ id: 'g1', status: 'ARCHIVED' }))
    renderApp('/groups/g1')

    await screen.findByRole('heading', { name: 'House 2026', level: 1 })

    expect(screen.getAllByText('Archived').length).toBeGreaterThan(0)
  })

  it('does not tell a group that does not exist from one the user cannot see', async () => {
    asSignedIn()
    server.use(http.get(`${API}/groups/secret`, () => problem(404, 'NOT_FOUND', 'Group not found')))
    renderApp('/groups/secret')

    expect(await screen.findByRole('heading', { name: 'Group not found' })).toBeInTheDocument()
    expect(screen.getByText('It does not exist, or you are not a member of it.')).toBeInTheDocument()
  })

  it('goes back to the list from a missing group', async () => {
    asSignedIn()
    server.use(http.get(`${API}/groups/secret`, () => problem(404, 'NOT_FOUND')))
    groupsAre([])
    const { user } = renderApp('/groups/secret')

    await user.click(await screen.findByRole('link', { name: 'Back to my groups' }))

    expect(await screen.findByRole('heading', { name: 'Your groups' })).toBeInTheDocument()
  })

  it('offers to try again when the group could not be loaded', async () => {
    asSignedIn()
    server.use(http.get(`${API}/groups/g1`, () => problem(500, 'INTERNAL_ERROR')))
    reportsAre('g1')
    const { user } = renderApp('/groups/g1')

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
    server.use(http.get(`${API}/groups/g1`, () => HttpResponse.json(group({ id: 'g1', name: 'Recovered' }))))
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { name: 'Recovered', level: 1 })).toBeInTheDocument()
  })

  it('goes back to the groups list from the header link', async () => {
    asSignedIn()
    groupIs(group({ id: 'g1' }))
    groupsAre([group({ id: 'g1' })])
    const { user } = renderApp('/groups/g1')

    await user.click(await screen.findByRole('link', { name: /← Groups/ }))

    expect(await screen.findByRole('heading', { name: 'Your groups' })).toBeInTheDocument()
  })
})
