import { isAxiosError } from 'axios'
import type { FieldError, ProblemDetail } from '@/types/api'

/** Every failed API call ends up as one of these, whatever went wrong. status 0 means no response at all. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors: FieldError[]

  constructor(status: number, code: string, message: string, fieldErrors: FieldError[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

export const NETWORK_ERROR = 'NETWORK_ERROR'
export const UNKNOWN_ERROR = 'UNKNOWN_ERROR'
export const REQUEST_ERROR = 'REQUEST_ERROR'

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error
  }
  if (isAxiosError(error)) {
    if (!error.response) {
      return new ApiError(0, NETWORK_ERROR, error.message)
    }
    const problem = (typeof error.response.data === 'object' && error.response.data !== null
      ? error.response.data
      : {}) as ProblemDetail
    return new ApiError(
      error.response.status,
      typeof problem.code === 'string' ? problem.code : REQUEST_ERROR,
      problem.detail ?? error.response.statusText ?? 'Request failed',
      Array.isArray(problem.fieldErrors) ? problem.fieldErrors : [],
    )
  }
  return new ApiError(0, UNKNOWN_ERROR, error instanceof Error ? error.message : String(error))
}

/** A lost race that the server says is safe to retry: nothing was saved. */
export function isRetryableConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && error.code === 'CONCURRENT_UPDATE'
}
