import axios, { type InternalAxiosRequestConfig } from 'axios'
import type { LoginResponse } from '@/types/api'
import { toApiError } from './errors'
import { tokenStore } from './tokenStore'

/** In development Vite proxies /api to Spring Boot; in production the same origin serves both. */
export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

/** These endpoints never carry the access token and are never retried after a 401: a 401 there is the answer. */
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']

type RetryableConfig = InternalAxiosRequestConfig & { retriedAfterRefresh?: boolean }

function isAuthPath(config: InternalAxiosRequestConfig): boolean {
  return AUTH_PATHS.some((path) => config.url?.endsWith(path))
}

let sessionLostHandler: (() => void) | null = null

/** Called when the session cannot be renewed any more, so the UI can send the user back to the login page. */
export function setSessionLostHandler(handler: (() => void) | null): void {
  sessionLostHandler = handler
}

let refreshing: Promise<LoginResponse> | null = null

/**
 * Renews the session from the HttpOnly refresh cookie. Refresh tokens rotate and a reused one revokes the whole
 * session, so there must never be two refreshes in flight: everyone who asks while one is running (several
 * requests failing together, or React StrictMode mounting twice) shares the same promise.
 */
export function refreshSession(): Promise<LoginResponse> {
  refreshing ??= api
    .post<LoginResponse>('/auth/refresh')
    .then((response) => {
      tokenStore.set(response.data.accessToken)
      return response.data
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token && !isAuthPath(config)) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const apiError = toApiError(error)
    const config = axios.isAxiosError(error) ? (error.config as RetryableConfig | undefined) : undefined

    if (apiError.status === 401 && config && !isAuthPath(config) && !config.retriedAfterRefresh) {
      try {
        await refreshSession()
      } catch {
        tokenStore.set(null)
        sessionLostHandler?.()
        throw apiError
      }
      config.retriedAfterRefresh = true
      return api.request(config)
    }
    throw apiError
  },
)
