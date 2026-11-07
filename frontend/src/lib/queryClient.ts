import { QueryClient } from '@tanstack/react-query'
import { ApiError, isRetryableConflict } from './api/errors'

const MAX_RETRIES = 2

/** Reading again is harmless when the network dropped or the server failed; a 4xx will not fix itself. */
function retryQuery(failures: number, error: unknown): boolean {
  if (failures >= MAX_RETRIES) {
    return false
  }
  return error instanceof ApiError && (error.status === 0 || error.status >= 500 || isRetryableConflict(error))
}

/** The server answers "nothing was saved, try again" for a lost race: repeating that write is safe. */
function retryMutation(failures: number, error: unknown): boolean {
  return failures < MAX_RETRIES && isRetryableConflict(error)
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: retryQuery },
      mutations: { retry: retryMutation },
    },
  })
}
