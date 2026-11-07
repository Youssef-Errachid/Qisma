import { createContext } from 'react'
import type { LoginRequest, UserResponse } from '@/types/api'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'
/** Why a session ended on purpose, to tell the person on the sign-in page. */
export type AuthNotice = 'passwordChanged'

export interface AuthContextValue {
  status: AuthStatus
  user: UserResponse | null
  notice: AuthNotice | null
  login: (request: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  /** The same person with new details (after the profile was saved). */
  setUser: (user: UserResponse) => void
  /**
   * Ends the session here and now, without asking the server. For when the server has already ended it: changing the
   * password revokes every refresh token, so staying "signed in" would only fail a few minutes later.
   */
  endSession: (notice?: AuthNotice) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
