import { api } from '@/lib/api/client'
import type { ChangePasswordRequest, UpdateProfileRequest, UserResponse } from '@/types/api'

export async function updateProfile(request: UpdateProfileRequest): Promise<UserResponse> {
  const { data } = await api.put<UserResponse>('/users/me', request)
  return data
}

/** Revokes every session of the account, this one included: the person signs in again afterwards. */
export async function changePassword(request: ChangePasswordRequest): Promise<void> {
  await api.put('/users/me/password', request)
}
