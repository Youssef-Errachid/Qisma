import { HttpResponse, http } from 'msw'
import type { ActivityLine, BalancesResponse, CategoryReport, ContributionsReport, ExpenseResponse, FieldError, GroupResponse, LoginResponse, InvitationSummary, MemberBalance, MemberResponse, MonthlyReport, PageResponse, ReportSummary, SettlementResponse, SuggestionsResponse, UserResponse } from '@/types/api'
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

/** A group whose reports are empty too, so every screen that opens a group has what it asks for. */
export function groupIs(g: GroupResponse) {
  server.use(http.get(`${API}/groups/${g.id}`, () => HttpResponse.json(g)))
  reportsAre(g.id)
}

export function member(overrides: Partial<MemberResponse> = {}): MemberResponse {
  return { userId: 'u-youssef', username: 'youssef', fullName: 'Youssef E.', role: 'OWNER', status: 'ACTIVE', joinedAt: '2026-11-01T10:00:00Z', ...overrides }
}

/** The three friends of the dev group. */
export const FRIENDS: MemberResponse[] = [
  member({ userId: 'u-youssef', username: 'youssef', fullName: 'Youssef E.', role: 'OWNER' }),
  member({ userId: 'u-ahmed', username: 'ahmed', fullName: 'Ahmed B.', role: 'MEMBER' }),
  member({ userId: 'u-hamza', username: 'hamza', fullName: 'Hamza K.', role: 'MEMBER' }),
]

export function membersAre(groupId: string, members: MemberResponse[] = FRIENDS) {
  server.use(http.get(`${API}/groups/${groupId}/members`, () => HttpResponse.json(members)))
}

export function expense(overrides: Partial<ExpenseResponse> = {}): ExpenseResponse {
  return {
    id: 'e1',
    groupId: 'g1',
    title: 'Groceries',
    description: null,
    amountMinor: 30000,
    currency: 'MAD',
    paidBy: 'u-youssef',
    category: 'FOOD',
    splitMethod: 'EQUAL',
    shares: [
      { userId: 'u-youssef', shareMinor: 10000, percentageBp: null },
      { userId: 'u-ahmed', shareMinor: 10000, percentageBp: null },
      { userId: 'u-hamza', shareMinor: 10000, percentageBp: null },
    ],
    expenseDate: '2026-11-03',
    status: 'ACTIVE',
    createdBy: 'u-youssef',
    createdAt: '2026-11-03T18:00:00Z',
    updatedAt: '2026-11-03T18:00:00Z',
    version: 0,
    ...overrides,
  }
}

export function pageOf<T>(items: T[], overrides: Partial<PageResponse<T>> = {}): PageResponse<T> {
  return { items, page: 0, size: 20, totalElements: items.length, totalPages: items.length === 0 ? 0 : 1, ...overrides }
}

export function expensesAre(groupId: string, page: PageResponse<ExpenseResponse>) {
  server.use(http.get(`${API}/groups/${groupId}/expenses`, () => HttpResponse.json(page)))
}

export function activityIs(groupId: string, lines: ActivityLine[]) {
  server.use(http.get(`${API}/groups/${groupId}/activity`, () => HttpResponse.json(pageOf(lines))))
}

export function invitation(overrides: Partial<InvitationSummary> = {}): InvitationSummary {
  return { id: 'i1', type: 'CODE', status: 'PENDING', useCount: 0, maxUses: 5, expiresAt: '2026-11-20T00:00:00Z', createdAt: '2026-11-07T10:00:00Z', ...overrides }
}

/** The invitations of a group; the array may be changed by a test, and the next request sees the change. */
export function invitationsAre(groupId: string, all: InvitationSummary[] = []) {
  server.use(http.get(`${API}/groups/${groupId}/invitations`, () => HttpResponse.json(all)))
  return all
}

export function balance(overrides: Partial<MemberBalance> = {}): MemberBalance {
  const net = overrides.netMinor ?? 0
  return {
    userId: 'u-youssef', username: 'youssef', fullName: 'Youssef E.', membershipStatus: 'ACTIVE',
    paidMinor: 0, shareMinor: 0, sentMinor: 0, receivedMinor: 0, netMinor: net,
    pendingOutMinor: 0, pendingInMinor: 0, effectiveNetMinor: net,
    ...overrides,
  }
}

/** Youssef is owed 100.00; Ahmed owes 150.00; Hamza is owed 50.00. */
export const BALANCES: BalancesResponse = {
  currency: 'MAD',
  sumMinor: 0,
  members: [
    balance({ userId: 'u-youssef', username: 'youssef', fullName: 'Youssef E.', netMinor: 10000, paidMinor: 30000, shareMinor: 20000 }),
    balance({ userId: 'u-ahmed', username: 'ahmed', fullName: 'Ahmed B.', netMinor: -15000, paidMinor: 5000, shareMinor: 20000 }),
    balance({ userId: 'u-hamza', username: 'hamza', fullName: 'Hamza K.', netMinor: 5000, paidMinor: 25000, shareMinor: 20000 }),
  ],
}

export function balancesAre(groupId: string, balances: BalancesResponse = BALANCES) {
  server.use(http.get(`${API}/groups/${groupId}/balances`, () => HttpResponse.json(balances)))
}

export function suggestionsAre(groupId: string, transfers: SuggestionsResponse['transfers'] = []) {
  server.use(http.get(`${API}/groups/${groupId}/settlements/suggestions`, () => HttpResponse.json({ currency: 'MAD', transfers })))
}

export function settlement(overrides: Partial<SettlementResponse> = {}): SettlementResponse {
  return {
    id: 's1', groupId: 'g1', fromUserId: 'u-ahmed', fromUsername: 'ahmed', toUserId: 'u-youssef', toUsername: 'youssef',
    amountMinor: 5000, currency: 'MAD', note: null, status: 'PENDING', createdAt: '2026-11-05T10:00:00Z',
    confirmedAt: null, rejectedAt: null, rejectionReason: null, cancelledAt: null, version: 0, ...overrides,
  }
}

/** A small fake of the settlements list: it filters by status and cuts pages like the server does. */
export function settlementsAre(groupId: string, all: SettlementResponse[]) {
  const seen: Array<Record<string, string>> = []
  server.use(http.get(`${API}/groups/${groupId}/settlements`, ({ request }) => {
    const params = new URL(request.url).searchParams
    seen.push(Object.fromEntries(params))
    const status = params.get('status')
    const page = Number(params.get('page') ?? 0)
    const size = Number(params.get('size') ?? 20)
    const filtered = all.filter((s) => !status || s.status === status)
    const items = filtered.slice(page * size, page * size + size)
    return HttpResponse.json({ items, page, size, totalElements: filtered.length, totalPages: Math.ceil(filtered.length / size) })
  }))
  return seen
}

export const emptySummary: ReportSummary = {
  currency: 'MAD',
  totalExpensesMinor: 0,
  expenseCount: 0,
  memberCount: 1,
  activeMemberCount: 1,
  outstandingDebtsMinor: 0,
  confirmedSettlementsMinor: 0,
  pendingSettlementsMinor: 0,
  pendingSettlementsCount: 0,
}

interface Reports {
  summary?: ReportSummary
  monthly?: MonthlyReport
  categories?: CategoryReport
  contributions?: ContributionsReport
}

export function reportsAre(groupId: string, reports: Reports = {}) {
  const base = `${API}/groups/${groupId}/reports`
  server.use(
    http.get(`${base}/summary`, () => HttpResponse.json(reports.summary ?? emptySummary)),
    http.get(`${base}/monthly`, () => HttpResponse.json(reports.monthly ?? { currency: 'MAD', from: '2025-12', to: '2026-11', months: [] })),
    http.get(`${base}/categories`, () => HttpResponse.json(reports.categories ?? { currency: 'MAD', from: null, to: null, totalMinor: 0, categories: [] })),
    http.get(`${base}/contributions`, () => HttpResponse.json(reports.contributions ?? { currency: 'MAD', from: null, to: null, members: [] })),
  )
}
