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

/** The query clients of the screens rendered in the current test, so that the test can wait until they are idle. */
const openClients = new Set<QueryClient>()

/**
 * Waits until no screen has a request in flight. A test that ends the moment a heading appears (which is shown at
 * once, before its data) would otherwise end with a request still on its way, and that request would reach the fake
 * server after its handlers were removed. How often that happened depended on the speed of the machine.
 */
export async function waitForIdle(timeoutMs = 3000, quietMs = 40): Promise<void> {
  if (openClients.size === 0) {
    return
  }
  const busy = () => [...openClients].some((client) => client.isFetching() > 0 || client.isMutating() > 0)
  const deadline = Date.now() + timeoutMs
  // "idle" must last a moment: a screen that has just appeared starts its requests a few milliseconds later
  let quietSince: number | null = null
  while (Date.now() < deadline) {
    if (busy()) {
      quietSince = null
    } else {
      quietSince ??= Date.now()
      if (Date.now() - quietSince >= quietMs) break
    }
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  openClients.clear()
}

/** Renders the real routes with the real providers, starting at a given URL. */
export function renderApp(path: string, { strict = false }: Options = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  openClients.add(queryClient)
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
