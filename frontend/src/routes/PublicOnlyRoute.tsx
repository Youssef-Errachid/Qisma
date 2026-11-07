import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { FullPageSpinner } from '@/components/ui/FullPageSpinner'
import { useAuth } from '@/features/auth/useAuth'

interface RedirectState {
  from?: { pathname?: string; search?: string }
}

/** Sign-in and sign-up are for strangers: a signed-in user goes where they were heading, or home. */
export function PublicOnlyRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <FullPageSpinner />
  }
  if (status === 'authenticated') {
    const from = (location.state as RedirectState | null)?.from
    return <Navigate to={`${from?.pathname ?? '/'}${from?.search ?? ''}`} replace />
  }
  return <Outlet />
}
