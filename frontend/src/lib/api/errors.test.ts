import { AxiosError, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import { ApiError, NETWORK_ERROR, REQUEST_ERROR, UNKNOWN_ERROR, isRetryableConflict, toApiError } from './errors'

function failure(status: number, data: unknown): AxiosError {
  const response = { status, statusText: 'Status text', data, headers: {}, config: {} } as AxiosResponse
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, response)
}

describe('toApiError', () => {
  it('reads the stable code, the message and the field errors from the server body', () => {
    const error = toApiError(failure(400, {
      status: 400, code: 'VALIDATION_FAILED', detail: 'Validation failed',
      fieldErrors: [{ field: 'email', message: 'must be a well-formed email address' }],
    }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(400)
    expect(error.code).toBe('VALIDATION_FAILED')
    expect(error.message).toBe('Validation failed')
    expect(error.fieldErrors).toEqual([{ field: 'email', message: 'must be a well-formed email address' }])
  })

  it('falls back to a generic code when the body is not ours (a proxy page, an empty body)', () => {
    expect(toApiError(failure(502, '<html>Bad gateway</html>')).code).toBe(REQUEST_ERROR)
    expect(toApiError(failure(500, null)).code).toBe(REQUEST_ERROR)
    expect(toApiError(failure(500, null)).status).toBe(500)
  })

  it('reports a missing response as a network error with status 0', () => {
    const error = toApiError(new AxiosError('Network Error', 'ERR_NETWORK'))

    expect(error.status).toBe(0)
    expect(error.code).toBe(NETWORK_ERROR)
  })

  it('wraps anything else, and never wraps twice', () => {
    expect(toApiError(new Error('boom')).code).toBe(UNKNOWN_ERROR)
    expect(toApiError('plain string').message).toBe('plain string')
    const original = new ApiError(409, 'X', 'x')
    expect(toApiError(original)).toBe(original)
  })
})

describe('isRetryableConflict', () => {
  it('is true only for the 409 the server marks as "nothing was saved, try again"', () => {
    expect(isRetryableConflict(new ApiError(409, 'CONCURRENT_UPDATE', 'x'))).toBe(true)
    expect(isRetryableConflict(new ApiError(409, 'VERSION_CONFLICT', 'x'))).toBe(false)
    expect(isRetryableConflict(new ApiError(500, 'CONCURRENT_UPDATE', 'x'))).toBe(false)
    expect(isRetryableConflict(new Error('x'))).toBe(false)
  })
})
