import { createContext } from 'react'
import type { LoginRequest, UserResponse } from '@/types/api'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export interface AuthContextValue {
  status: AuthStatus
  user: UserResponse | null
  login: (request: LoginRequest) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
