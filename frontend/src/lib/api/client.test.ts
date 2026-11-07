import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { API, problem, session } from '@/test/fixtures'
import { server } from '@/test/server'
import { api, refreshSession, setSessionLostHandler } from './client'
import { ApiError } from './errors'
import { tokenStore } from './tokenStore'

describe('api client', () => {
  it('sends the access token as a bearer token', async () => {
    tokenStore.set('abc')
    let received: string | null = null
    server.use(http.get(`${API}/users/me`, ({ request }) => {
      received = request.headers.get('Authorization')
      return HttpResponse.json({ ok: true })
    }))

    await api.get('/users/me')

    expect(received).toBe('Bearer abc')
  })

  it('never sends the token to the auth endpoints', async () => {
    tokenStore.set('abc')
    let received: string | null = 'unset'
    server.use(http.post(`${API}/auth/login`, ({ request }) => {
      received = request.headers.get('Authorization')
      return HttpResponse.json(session())
    }))

    await api.post('/auth/login', {})

    expect(received).toBeNull()
  })

  it('renews the session after a 401 and repeats the request once, with the new token', async () => {
    tokenStore.set('expired')
    const seen: Array<string | null> = []
    server.use(
      http.get(`${API}/groups`, ({ request }) => {
        seen.push(request.headers.get('Authorization'))
        return request.headers.get('Authorization') === 'Bearer fresh'
          ? HttpResponse.json([{ id: 'g1' }])
          : problem(401, 'UNAUTHORIZED')
      }),
      http.post(`${API}/auth/refresh`, () => HttpResponse.json(session('fresh'))),
    )

    const response = await api.get('/groups')

    expect(response.data).toEqual([{ id: 'g1' }])
    expect(seen).toEqual(['Bearer expired', 'Bearer fresh'])
    expect(tokenStore.get()).toBe('fresh')
  })

  it('shares ONE refresh between requests that fail together (a reused refresh token would end the session)', async () => {
    tokenStore.set('expired')
    let refreshes = 0
    server.use(
      http.get(`${API}/*`, ({ request }) =>
        request.headers.get('Authorization') === 'Bearer fresh' ? HttpResponse.json({ ok: true }) : problem(401, 'UNAUTHORIZED')),
      http.post(`${API}/auth/refresh`, async () => {
        refreshes++
        await new Promise((resolve) => setTimeout(resolve, 30))
        return HttpResponse.json(session('fresh'))
      }),
    )

    const results = await Promise.all([api.get('/groups'), api.get('/balances'), api.get('/members'), api.get('/reports')])

    expect(results.every((r) => r.status === 200)).toBe(true)
    expect(refreshes).toBe(1)
  })

  it('gives up, forgets the token and tells the app when the session cannot be renewed', async () => {
    tokenStore.set('expired')
    const lost = vi.fn()
    setSessionLostHandler(lost)
    server.use(
      http.get(`${API}/groups`, () => problem(401, 'UNAUTHORIZED')),
      http.post(`${API}/auth/refresh`, () => problem(401, 'INVALID_REFRESH_TOKEN')),
    )

    await expect(api.get('/groups')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' })

    expect(lost).toHaveBeenCalledTimes(1)
    expect(tokenStore.get()).toBeNull()
    setSessionLostHandler(null)
  })

  it('does not loop: a request that is still refused after a renewal fails', async () => {
    tokenStore.set('expired')
    let calls = 0
    server.use(
      http.get(`${API}/groups`, () => {
        calls++
        return problem(401, 'UNAUTHORIZED')
      }),
      http.post(`${API}/auth/refresh`, () => HttpResponse.json(session('fresh'))),
    )

    await expect(api.get('/groups')).rejects.toMatchObject({ status: 401 })

    expect(calls).toBe(2)
  })

  it('treats a 401 from login as the answer, not as an expired session', async () => {
    let refreshes = 0
    server.use(
      http.post(`${API}/auth/login`, () => problem(401, 'INVALID_CREDENTIALS')),
      http.post(`${API}/auth/refresh`, () => {
        refreshes++
        return HttpResponse.json(session())
      }),
    )

    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })

    expect(refreshes).toBe(0)
  })

  it('does not retry other errors, and always rejects with an ApiError', async () => {
    server.use(http.get(`${API}/groups/x`, () => problem(404, 'NOT_FOUND', 'Group not found')))

    const error = await api.get('/groups/x').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'Group not found' })
  })

  it('refreshSession can be called again once the previous renewal is over', async () => {
    let refreshes = 0
    server.use(http.post(`${API}/auth/refresh`, () => {
      refreshes++
      return HttpResponse.json(session(`t${refreshes}`))
    }))

    await refreshSession()
    await refreshSession()

    expect(refreshes).toBe(2)
    expect(tokenStore.get()).toBe('t2')
  })
})
