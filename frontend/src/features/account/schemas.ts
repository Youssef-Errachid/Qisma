import { z } from 'zod'
import { LANGUAGES } from '@/types/api'

const required = { error: 'validation.required' }

export const profileSchema = z.object({
  fullName: z.string().trim().min(1, required).max(100, { error: 'validation.fullNameLength' }),
  preferredLanguage: z.enum(LANGUAGES, required),
})
export type ProfileForm = z.infer<typeof profileSchema>

/** The rules of the API's own ChangePasswordRequest. Messages are translation keys. */
export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, required).max(72, { error: 'validation.tooLong' }),
    newPassword: z
      .string()
      .min(1, required)
      .min(8, { error: 'validation.passwordLength' })
      .max(72, { error: 'validation.passwordLength' })
      .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, { error: 'validation.passwordStrength' }),
    confirmNewPassword: z.string().min(1, required),
  })
  .refine((form) => form.newPassword === form.confirmNewPassword, { error: 'validation.passwordMismatch', path: ['confirmNewPassword'] })
  .refine((form) => form.newPassword !== form.currentPassword, { error: 'validation.passwordSame', path: ['newPassword'] })
export type PasswordForm = z.infer<typeof passwordSchema>
