import { api, refreshSession } from '@/lib/api/client'
import { tokenStore } from '@/lib/api/tokenStore'
import type { LoginRequest, LoginResponse, RegisterRequest, UserResponse } from '@/types/api'

export { refreshSession }

export async function login(request: LoginRequest): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', request)
  tokenStore.set(data.accessToken)
  return data
}

/** Creates the account only: the user signs in afterwards (there is no e-mail verification in version 1). */
export async function registerAccount(request: RegisterRequest): Promise<UserResponse> {
  const { data } = await api.post<UserResponse>('/auth/register', request)
  return data
}

/**
 * Signing out is only real once the server has been told: it is the server that clears the HttpOnly refresh
 * cookie. If it cannot be reached this throws and the user stays signed in, because forgetting the token alone
 * would let the next page load restore the session from the cookie, and on a shared computer that is dangerous.
 */
export async function logout(): Promise<void> {
  await api.post('/auth/logout')
  tokenStore.set(null)
}
