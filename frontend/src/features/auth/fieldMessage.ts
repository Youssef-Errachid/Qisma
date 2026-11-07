import type { TFunction } from 'i18next'

/** A form error is a translation key (from our schemas) or already a sentence (from the server): t() handles both. */
export function fieldMessage(t: TFunction, message: string | undefined): string | undefined {
  return message ? t(message) : undefined
}
