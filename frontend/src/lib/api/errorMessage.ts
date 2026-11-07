import type { TFunction } from 'i18next'
import { ApiError, UNKNOWN_ERROR } from './errors'

/** Turns any failure into a sentence in the user's language, never into raw server text. */
export function errorMessage(t: TFunction, error: unknown): string {
  const code = error instanceof ApiError ? error.code : UNKNOWN_ERROR
  return t(`errors.${code}`, { defaultValue: t('errors.generic') })
}
