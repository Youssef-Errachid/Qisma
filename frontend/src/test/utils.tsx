import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { appRoutes } from '@/routes/appRoutes'

interface Options {
  strict?: boolean
}

/** Renders the real routes with the real providers, starting at a given URL. */
export function renderApp(path: string, { strict = false }: Options = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  const tree = (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  )
  const view = render(strict ? <StrictMode>{tree}</StrictMode> : tree)
  return { ...view, router, user: userEvent.setup() }
}
