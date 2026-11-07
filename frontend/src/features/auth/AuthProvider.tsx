import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { adoptPreferredLanguage } from '@/i18n'
import { setSessionLostHandler } from '@/lib/api/client'
import { tokenStore } from '@/lib/api/tokenStore'
import type { LoginRequest, UserResponse } from '@/types/api'
import * as authService from './authService'
import { AuthContext, type AuthContextValue, type AuthNotice, type AuthStatus } from './AuthContext'

interface AuthState {
  status: AuthStatus
  user: UserResponse | null
  notice: AuthNotice | null
}

const ANONYMOUS: AuthState = { status: 'anonymous', user: null, notice: null }

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null, notice: null })

  useEffect(() => {
    let active = true

    // On every page load the HttpOnly cookie either gives a new access token or the user is a stranger.
    // refreshSession() is single-flight, so React StrictMode's second mount shares this very request.
    authService
      .refreshSession()
      .then((session) => {
        if (active) {
          adoptPreferredLanguage(session.user.preferredLanguage)
          setState({ status: 'authenticated', user: session.user, notice: null })
        }
      })
      .catch(() => {
        if (active) {
          setState(ANONYMOUS)
        }
      })

    setSessionLostHandler(() => {
      queryClient.clear()
      setState(ANONYMOUS)
    })

    return () => {
      active = false
      setSessionLostHandler(null)
    }
  }, [queryClient])

  const login = useCallback(async (request: LoginRequest) => {
    const session = await authService.login(request)
    adoptPreferredLanguage(session.user.preferredLanguage)
    setState({ status: 'authenticated', user: session.user, notice: null })
  }, [])

  const logout = useCallback(async () => {
    await authService.logout() // throws when the server could not be told: the user then stays signed in
    // nothing fetched for the previous user may be shown to the next one
    queryClient.clear()
    setState(ANONYMOUS)
  }, [queryClient])

  const setUser = useCallback((user: UserResponse) => setState((previous) => ({ ...previous, user })), [])

  const endSession = useCallback(
    (notice?: AuthNotice) => {
      tokenStore.set(null)
      queryClient.clear()
      setState({ ...ANONYMOUS, notice: notice ?? null })
    },
    [queryClient],
  )

  const value = useMemo<AuthContextValue>(
    () => ({ status: state.status, user: state.user, notice: state.notice, login, logout, setUser, endSession }),
    [state, login, logout, setUser, endSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
