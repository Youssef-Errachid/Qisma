import { z } from 'zod'
import { parseMoney } from '@/lib/money'

export function settlementSchema(digits: number) {
  return z.object({
    toUserId: z.string().min(1, { error: 'validation.required' }),
    amount: z
      .string()
      .trim()
      .min(1, { error: 'validation.required' })
      .refine((text) => parseMoney(text, digits) !== null, { error: 'validation.amountInvalid' }),
    note: z.string().trim().max(200, { error: 'validation.tooLong' }),
  })
}
export type SettlementFormValues = z.infer<ReturnType<typeof settlementSchema>>
