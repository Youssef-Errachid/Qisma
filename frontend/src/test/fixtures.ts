import { HttpResponse, http } from 'msw'
import type { FieldError, GroupResponse, LoginResponse, UserResponse } from '@/types/api'
import { server } from './server'

export const API = '*/api/v1'

export const youssef: UserResponse = {
  id: 'u-youssef',
  username: 'youssef',
  fullName: 'Youssef Errachid',
  email: 'youssef@test.com',
  profileImage: null,
  preferredLanguage: 'FR',
  createdAt: '2026-11-01T10:00:00Z',
}

export function session(accessToken = 'token-1', user: UserResponse = youssef): LoginResponse {
  return { accessToken, tokenType: 'Bearer', expiresIn: 900, user }
}

/** An RFC 7807 error exactly as the Spring Boot API sends it. */
export function problem(status: number, code: string, detail = code, fieldErrors?: FieldError[]) {
  return HttpResponse.json({ status, title: code, detail, code, ...(fieldErrors ? { fieldErrors } : {}) }, { status })
}

export function group(overrides: Partial<GroupResponse> = {}): GroupResponse {
  return {
    id: 'g1',
    name: 'House 2026',
    description: null,
    currency: 'MAD',
    status: 'ACTIVE',
    ownerId: 'u-youssef',
    myRole: 'OWNER',
    createdAt: '2026-11-05T09:00:00Z',
    ...overrides,
  }
}

// ---- the start-up session check every screen goes through ----

/** The refresh cookie is valid: the app starts signed in as youssef. */
export function asSignedIn() {
  server.use(http.post(`${API}/auth/refresh`, () => HttpResponse.json(session('t-restored'))))
}

/** No valid cookie: the app starts with nobody signed in. */
export function asStranger() {
  server.use(http.post(`${API}/auth/refresh`, () => problem(401, 'INVALID_REFRESH_TOKEN')))
}

export function groupsAre(groups: GroupResponse[]) {
  server.use(http.get(`${API}/groups`, () => HttpResponse.json(groups)))
}

export function groupIs(g: GroupResponse) {
  server.use(http.get(`${API}/groups/${g.id}`, () => HttpResponse.json(g)))
}
