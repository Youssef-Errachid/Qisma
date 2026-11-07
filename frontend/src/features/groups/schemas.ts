import { z } from 'zod'
import { SUPPORTED_CURRENCIES } from './currencies'

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, { error: 'validation.required' }).max(80, { error: 'validation.tooLong' }),
  description: z.string().trim().max(500, { error: 'validation.tooLong' }),
  currency: z.enum(SUPPORTED_CURRENCIES, { error: 'validation.required' }),
})
export type CreateGroupForm = z.infer<typeof createGroupSchema>

/**
 * The settings of an existing group. The currency is any ISO 4217 code, not only the ones in the menu of the creation
 * form: a group made through the API may use another, and the form must show it as it is instead of changing it.
 */
export const groupSettingsSchema = z.object({
  name: z.string().trim().min(1, { error: 'validation.required' }).max(80, { error: 'validation.tooLong' }),
  description: z.string().trim().max(500, { error: 'validation.tooLong' }),
  currency: z.string().regex(/^[A-Z]{3}$/, { error: 'validation.required' }),
})
export type GroupSettingsForm = z.infer<typeof groupSettingsSchema>
