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
export function parseMoney(input: string, digits = 2, { allowZero = false }: { allowZero?: boolean } = {}): number | null {
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
  if (!Number.isSafeInteger(minor) || minor < 0 || (minor === 0 && !allowZero) || minor > MAX_AMOUNT_MINOR) {
    return null
  }
  return minor
}

/**
 * Minor units as the text a person would type: 3334 is "33.34", 5000 is "50.00". Plain digits and a dot, which
 * parseMoney reads back exactly.
 */
export function minorToInput(minor: number, digits = 2): string {
  if (digits === 0) {
    return String(minor)
  }
  const unit = 10 ** digits
  return `${Math.floor(minor / unit)}.${String(minor % unit).padStart(digits, '0')}`
}

/** "50", "33.33", "33,3" or "12.5%" become basis points (5000, 3333, 3330, 1250). Null above 100%, or beyond two decimals. */
export function parsePercent(input: string): number | null {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(input.trim().replace(/%$/, '').replace(/[\s\u00a0\u202f]/g, ''))
  if (!match) {
    return null
  }
  const bp = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return bp <= 10_000 ? bp : null
}

/** Basis points as typed text: 3333 is "33.33", 5000 is "50", 10000 is "100". */
export function bpToInput(bp: number): string {
  const whole = Math.floor(bp / 100)
  const fraction = bp % 100
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, '0').replace(/0$/, '')}`
}

/** Display only: 123450 becomes "1,234.50 MAD" (or the locale's own form). Signed amounts keep their sign. */
export function formatMoney(minor: number, currency: string, locale: string): string {
  const digits = fractionDigits(currency, locale)
  return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'code' }).format(
    minor / 10 ** digits,
  )
}
