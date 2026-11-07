import { z } from 'zod'
import { SUPPORTED_CURRENCIES } from './currencies'

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, { error: 'validation.required' }).max(80, { error: 'validation.tooLong' }),
  description: z.string().trim().max(500, { error: 'validation.tooLong' }),
  currency: z.enum(SUPPORTED_CURRENCIES, { error: 'validation.required' }),
})
export type CreateGroupForm = z.infer<typeof createGroupSchema>
