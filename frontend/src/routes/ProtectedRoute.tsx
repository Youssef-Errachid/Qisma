import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { FullPageSpinner } from '@/components/ui/FullPageSpinner'
import { useAuth } from '@/features/auth/useAuth'

/** Everything inside needs a signed-in user. The server re-checks every request: this is only about the screens. */
export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <FullPageSpinner />
  }
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}
