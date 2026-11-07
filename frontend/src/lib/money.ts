/**
 * Money is an integer number of minor units (centimes) everywhere in the app. Nothing here ever does arithmetic on
 * decimals: user input is parsed as text, and the only division is for display.
 */

/** Largest amount the API accepts for one operation, in minor units. */
export const MAX_AMOUNT_MINOR = 1_000_000_000_000

export function fractionDigits(currency: string, locale = 'en'): number {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
}

/**
 * "12", "12.5", "12,50" and "1 234,50" become 1200, 1250, 1250 and 123450. Returns null for anything else:
 * empty, negative, zero, letters, more decimals than the currency has, or above the API limit.
 */
export function parseMoney(input: string, digits = 2): number | null {
  const text = input.trim().replace(/[\s\u00a0\u202f]/g, '')
  const match = /^(\d+)(?:[.,](\d+))?$/.exec(text)
  if (!match) {
    return null
  }
  const [, whole, fraction = ''] = match
  if (fraction.length > digits) {
    return null
  }
  const minor = Number(whole + fraction.padEnd(digits, '0'))
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > MAX_AMOUNT_MINOR) {
    return null
  }
  return minor
}

/** Display only: 123450 becomes "1,234.50 MAD" (or the locale's own form). Signed amounts keep their sign. */
export function formatMoney(minor: number, currency: string, locale: string): string {
  const digits = fractionDigits(currency, locale)
  return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'code' }).format(
    minor / 10 ** digits,
  )
}
