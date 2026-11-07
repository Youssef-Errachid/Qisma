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
