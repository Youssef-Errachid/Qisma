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
