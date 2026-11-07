import { z } from 'zod'
import { parseMoney } from '@/lib/money'
import { EXPENSE_CATEGORIES, SPLIT_METHODS } from '@/types/api'
import { validDate } from './filters'

/**
 * The fields of an expense that are plain values. Who takes part and how it is split is checked apart (formModel),
 * because it depends on several boxes at once. Messages are translation keys.
 */
export function expenseSchema(digits: number) {
  return z.object({
    title: z.string().trim().min(1, { error: 'validation.required' }).max(120, { error: 'validation.tooLong' }),
    description: z.string().trim().max(1000, { error: 'validation.tooLong' }),
    amount: z
      .string()
      .trim()
      .min(1, { error: 'validation.required' })
      .refine((text) => parseMoney(text, digits) !== null, { error: 'validation.amountInvalid' }),
    expenseDate: z.string().refine(validDate, { error: 'validation.dateInvalid' }),
    category: z.enum(EXPENSE_CATEGORIES),
    paidBy: z.string().min(1, { error: 'validation.required' }),
    splitMethod: z.enum(SPLIT_METHODS),
  })
}
export type ExpenseFormValues = z.infer<ReturnType<typeof expenseSchema>>
