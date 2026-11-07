import { screen, within } from '@testing-library/react'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { API, asSignedIn, group, groupIs, groupsAre, problem } from '@/test/fixtures'
import { server } from '@/test/server'
import { renderApp } from '@/test/utils'

describe('GroupsPage', () => {
  it('lists the groups with their currency and the role of the user', async () => {
    asSignedIn()
    groupsAre([
      group({ id: 'g1', name: 'House 2026', description: 'Shared flat in Marrakech', currency: 'MAD', myRole: 'OWNER' }),
      group({ id: 'g2', name: 'Trip to Essaouira', currency: 'EUR', myRole: 'MEMBER', createdAt: '2026-11-06T09:00:00Z' }),
    ])
    renderApp('/groups')

    const house = (await screen.findByRole('heading', { name: 'House 2026' })).closest('li') as HTMLElement
    expect(within(house).getByText('MAD')).toBeInTheDocument()
    expect(within(house).getByText('Owner')).toBeInTheDocument()
    expect(within(house).getByText('Shared flat in Marrakech')).toBeInTheDocument()

    const trip = screen.getByRole('heading', { name: 'Trip to Essaouira' }).closest('li') as HTMLElement
    expect(within(trip).getByText('EUR')).toBeInTheDocument()
    expect(within(trip).getByText('Member')).toBeInTheDocument()
  })

  it('shows the active groups first (newest first) and marks the archived ones', async () => {
    asSignedIn()
    groupsAre([
      group({ id: 'a', name: 'Archived one', status: 'ARCHIVED', createdAt: '2026-11-07T00:00:00Z' }),
      group({ id: 'b', name: 'Older active', createdAt: '2026-10-01T00:00:00Z' }),
      group({ id: 'c', name: 'Newer active', createdAt: '2026-11-01T00:00:00Z' }),
    ])
    renderApp('/groups')

    await screen.findByRole('heading', { name: 'Newer active' })
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Newer active', 'Older active', 'Archived one'])
    expect(within(screen.getByRole('heading', { name: 'Archived one' }).closest('li') as HTMLElement).getByText('Archived')).toBeInTheDocument()
  })

  it('invites the user to create a group when there is none', async () => {
    asSignedIn()
    groupsAre([])
    const { user } = renderApp('/groups')

    expect(await screen.findByText('No groups yet')).toBeInTheDocument()
    await user.click(screen.getAllByRole('link', { name: 'New group' })[1])

    expect(await screen.findByRole('heading', { name: 'New group', level: 1 })).toBeInTheDocument()
  })

  it('says what went wrong and lets the user try again', async () => {
    asSignedIn()
    server.use(http.get(`${API}/groups`, () => problem(500, 'INTERNAL_ERROR')))
    const { user } = renderApp('/groups')

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')

    groupsAre([group({ name: 'Back online' })])
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { name: 'Back online' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('opens a group when its card is clicked', async () => {
    asSignedIn()
    groupsAre([group({ id: 'g1', name: 'House 2026' })])
    groupIs(group({ id: 'g1', name: 'House 2026' }))
    const { user, router } = renderApp('/groups')

    await user.click(await screen.findByRole('link', { name: /House 2026/ }))

    expect(await screen.findByRole('heading', { name: 'House 2026', level: 1 })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/groups/g1')
  })

  it('links to joining a group', async () => {
    asSignedIn()
    groupsAre([group()])
    const { user } = renderApp('/groups')

    // the header navigation has a link of the same name: this is the one inside the page
    await user.click(within(await screen.findByRole('main')).getByRole('link', { name: 'Join a group' }))

    expect(await screen.findByRole('heading', { name: 'Join a group', level: 1 })).toBeInTheDocument()
  })

  it('shows the group dates in the language of the user', async () => {
    asSignedIn()
    groupsAre([group({ createdAt: '2026-11-05T09:00:00Z' })])
    const { user } = renderApp('/groups')
    expect(await screen.findByText('5 Nov 2026')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Language'), 'fr')

    expect(await screen.findByText('5 nov. 2026')).toBeInTheDocument()
  })
})
