import { z } from 'zod'

/** The rules mirror the API's own (RegisterRequest). Messages are translation keys, translated where shown. */
const required = { error: 'validation.required' }

export const loginSchema = z.object({
  email: z.string().trim().min(1, required).max(254, { error: 'validation.tooLong' }),
  password: z.string().min(1, required).max(72, { error: 'validation.tooLong' }),
})
export type LoginForm = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(1, required)
      .min(3, { error: 'validation.usernameLength' })
      .max(30, { error: 'validation.usernameLength' })
      .regex(/^[A-Za-z0-9._-]+$/, { error: 'validation.usernamePattern' }),
    fullName: z.string().trim().min(1, required).max(100, { error: 'validation.fullNameLength' }),
    email: z
      .string()
      .trim()
      .min(1, required)
      .max(254, { error: 'validation.tooLong' })
      .pipe(z.email({ error: 'validation.email' })),
    password: z
      .string()
      .min(1, required)
      .min(8, { error: 'validation.passwordLength' })
      .max(72, { error: 'validation.passwordLength' })
      .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, { error: 'validation.passwordStrength' }),
    confirmPassword: z.string().min(1, required),
  })
  .refine((form) => form.password === form.confirmPassword, {
    error: 'validation.passwordMismatch',
    path: ['confirmPassword'],
  })
export type RegisterForm = z.infer<typeof registerSchema>
