/** Mirrors the Spring Boot API. Money is always an integer in minor units (centimes). */

export const LANGUAGES = ['FR', 'EN', 'AR'] as const
export type Language = (typeof LANGUAGES)[number]

export interface UserResponse {
  id: string
  username: string
  fullName: string
  email: string
  profileImage: string | null
  preferredLanguage: Language
  createdAt: string
}

export const GROUP_ROLES = ['OWNER', 'MEMBER'] as const
export type GroupRole = (typeof GROUP_ROLES)[number]

export const GROUP_STATUSES = ['ACTIVE', 'ARCHIVED'] as const
export type GroupStatus = (typeof GROUP_STATUSES)[number]

export const INVITATION_TYPES = ['LINK', 'CODE'] as const
export type InvitationType = (typeof INVITATION_TYPES)[number]

export interface GroupResponse {
  id: string
  name: string
  description: string | null
  /** ISO 4217 code, e.g. MAD. Fixed once the group has its first expense. */
  currency: string
  status: GroupStatus
  ownerId: string
  /** The caller's own role in this group. */
  myRole: GroupRole
  createdAt: string
}

export interface CreateGroupRequest {
  name: string
  description?: string
  currency?: string
}

export interface InvitationPreview {
  groupName: string
  currency: string
  type: InvitationType
  expiresAt: string | null
}

export const EXPENSE_CATEGORIES = [
  'FOOD', 'ELECTRICITY', 'WATER', 'INTERNET', 'RENT', 'TRANSPORTATION', 'CLEANING', 'HOUSEHOLD', 'OTHER',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

/** Every amount below is an integer in minor units (centimes). */
export interface ReportSummary {
  currency: string
  totalExpensesMinor: number
  expenseCount: number
  memberCount: number
  activeMemberCount: number
  /** what the creditors are still owed, equal to what the debtors still owe */
  outstandingDebtsMinor: number
  confirmedSettlementsMinor: number
  pendingSettlementsMinor: number
  pendingSettlementsCount: number
}

export interface MonthlyPoint {
  /** yyyy-MM */
  month: string
  totalMinor: number
  count: number
}

export interface MonthlyReport {
  currency: string
  from: string
  to: string
  months: MonthlyPoint[]
}

export interface CategoryItem {
  category: ExpenseCategory
  totalMinor: number
  count: number
  /** share of the total in basis points (10000 = 100%), rounded, for display only */
  shareBp: number
}

export interface CategoryReport {
  currency: string
  from: string | null
  to: string | null
  totalMinor: number
  categories: CategoryItem[]
}

export interface MemberContribution {
  userId: string
  username: string
  fullName: string
  paidMinor: number
  shareMinor: number
}

export interface ContributionsReport {
  currency: string
  from: string | null
  to: string | null
  members: MemberContribution[]
}

export const SPLIT_METHODS = ['EQUAL', 'CUSTOM', 'PERCENTAGE'] as const
export type SplitMethod = (typeof SPLIT_METHODS)[number]

export type ExpenseStatus = 'ACTIVE' | 'DELETED'
export type MembershipStatus = 'ACTIVE' | 'INACTIVE'

export interface PageResponse<T> {
  items: T[]
  /** zero-based */
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface MemberResponse {
  userId: string
  username: string
  fullName: string
  role: GroupRole
  status: MembershipStatus
  joinedAt: string
}

/** Only the field that belongs to the split method is sent: the server refuses an EQUAL split that carries amounts. */
export interface ParticipantInput {
  userId: string
  shareMinor?: number
  percentageBp?: number
}

export interface ExpenseRequest {
  title: string
  description?: string
  amountMinor: number
  paidBy: string
  /** yyyy-MM-dd */
  expenseDate: string
  category: ExpenseCategory
  splitMethod: SplitMethod
  participants: ParticipantInput[]
}

export interface UpdateExpenseRequest extends ExpenseRequest {
  /** the version the user was looking at: a stale one is refused, so nobody overwrites a change they never saw */
  version: number
}

export interface ExpenseShare {
  userId: string
  shareMinor: number
  /** only for PERCENTAGE splits: 10000 = 100% */
  percentageBp: number | null
}

export interface ExpenseResponse {
  id: string
  groupId: string
  title: string
  description: string | null
  amountMinor: number
  currency: string
  paidBy: string
  category: ExpenseCategory
  splitMethod: SplitMethod
  shares: ExpenseShare[]
  /** yyyy-MM-dd */
  expenseDate: string
  status: ExpenseStatus
  createdBy: string
  createdAt: string
  updatedAt: string
  /** needed to edit: the server refuses a stale one */
  version: number
}

export const ACTIVITY_ACTIONS = [
  'EXPENSE_CREATED', 'EXPENSE_UPDATED', 'EXPENSE_DELETED',
  'SETTLEMENT_CREATED', 'SETTLEMENT_CONFIRMED', 'SETTLEMENT_REJECTED', 'SETTLEMENT_CANCELLED',
  'GROUP_UPDATED', 'GROUP_ARCHIVED', 'OWNERSHIP_TRANSFERRED', 'MEMBER_LEFT', 'MEMBER_DEACTIVATED',
] as const
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number]

export interface ActivityLine {
  id: string
  action: ActivityAction
  entityType: 'EXPENSE' | 'SETTLEMENT' | 'GROUP' | 'MEMBERSHIP'
  entityId: string
  actorId: string
  actorUsername: string
  createdAt: string
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
}

export const SETTLEMENT_STATUSES = ['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED'] as const
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number]

/**
 * net = paid - share + sent - received, over expenses and CONFIRMED repayments only: positive means the member should
 * receive money, negative means they owe it. effectiveNet = net + pendingOut - pendingIn: where they end up once every
 * repayment still waiting is confirmed. All integers in minor units.
 */
export interface MemberBalance {
  userId: string
  username: string
  fullName: string
  membershipStatus: MembershipStatus
  paidMinor: number
  shareMinor: number
  sentMinor: number
  receivedMinor: number
  netMinor: number
  pendingOutMinor: number
  pendingInMinor: number
  effectiveNetMinor: number
}

export interface BalancesResponse {
  currency: string
  /** must always be 0: what some are owed is exactly what others owe */
  sumMinor: number
  members: MemberBalance[]
}

export interface TransferSuggestion {
  fromUserId: string
  fromUsername: string
  toUserId: string
  toUsername: string
  amountMinor: number
}

export interface SuggestionsResponse {
  currency: string
  transfers: TransferSuggestion[]
}

export interface SettlementResponse {
  id: string
  groupId: string
  fromUserId: string
  fromUsername: string
  toUserId: string
  toUsername: string
  amountMinor: number
  currency: string
  note: string | null
  status: SettlementStatus
  createdAt: string
  confirmedAt: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  cancelledAt: string | null
  version: number
}

export interface CreateSettlementRequest {
  toUserId: string
  amountMinor: number
  note?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  username: string
  fullName: string
  email: string
  password: string
  confirmPassword: string
}

export interface LoginResponse {
  accessToken: string
  tokenType: string
  /** seconds */
  expiresIn: number
  user: UserResponse
}

export interface FieldError {
  field: string
  message: string
}

/** RFC 7807 body of every error the API returns, plus our stable machine-readable `code`. */
export interface ProblemDetail {
  status?: number
  title?: string
  detail?: string
  code?: string
  fieldErrors?: FieldError[]
}
