import { describe, expect, it } from 'vitest'
import { MAX_AMOUNT_MINOR, formatMoney, parseMoney } from './money'

describe('parseMoney', () => {
  it('turns typed amounts into whole minor units, without any decimal arithmetic', () => {
    expect(parseMoney('12')).toBe(1200)
    expect(parseMoney('12.5')).toBe(1250)
    expect(parseMoney('12,50')).toBe(1250)
    expect(parseMoney('0.01')).toBe(1)
    expect(parseMoney('100.00')).toBe(10000)
    expect(parseMoney('1 234,50')).toBe(123450)
    expect(parseMoney('1\u00a0234,50')).toBe(123450)
    expect(parseMoney('  7.05  ')).toBe(705)
  })

  it('is exact where floating point would not be', () => {
    expect(parseMoney('0.1')).toBe(10)
    expect(parseMoney('0.29')).toBe(29)        // 0.29 * 100 === 28.999999999999996 in floating point
    expect(parseMoney('1.15')).toBe(115)       // 1.15 * 100 === 114.99999999999999
    expect(parseMoney('4.35')).toBe(435)       // 4.35 * 100 === 434.99999999999994
  })

  it('refuses everything that is not a positive amount with at most two decimals', () => {
    for (const bad of ['', '   ', 'abc', '-5', '+5', '0', '0.00', '1.234', '1.2.3', '1,2,3', '12 EUR', '1e3', '.5', '5.']) {
      expect(parseMoney(bad), JSON.stringify(bad)).toBeNull()
    }
  })

  it('refuses amounts the API would refuse', () => {
    expect(parseMoney('10000000000')).toBe(MAX_AMOUNT_MINOR)
    expect(parseMoney('10000000000.01')).toBeNull()
    expect(parseMoney('99999999999999999999')).toBeNull()
  })

  it('honours the number of decimals of the currency', () => {
    expect(parseMoney('12', 0)).toBe(12)
    expect(parseMoney('12.5', 0)).toBeNull()
    expect(parseMoney('1.234', 3)).toBe(1234)
  })
})

describe('formatMoney', () => {
  it('shows minor units as an amount in the locale', () => {
    // Intl separates the code from the number with a non-breaking space: compare with an ordinary one
    const plain = (text: string) => text.replace(/[\s\u00a0\u202f]/g, ' ')
    expect(plain(formatMoney(123450, 'MAD', 'en'))).toBe('MAD 1,234.50')
    expect(plain(formatMoney(5, 'MAD', 'en'))).toBe('MAD 0.05')
    expect(plain(formatMoney(0, 'MAD', 'en'))).toBe('MAD 0.00')
  })

  it('keeps the sign of what is owed', () => {
    expect(formatMoney(-25333, 'MAD', 'en')).toContain('253.33')
    expect(formatMoney(-25333, 'MAD', 'en')).toMatch(/-/)
  })

  it('uses the separators of the language', () => {
    const french = formatMoney(123450, 'MAD', 'fr').replace(/[\s\u00a0\u202f]/g, ' ')
    expect(french).toBe('1 234,50 MAD')
  })

  it('round-trips what the user types', () => {
    for (const minor of [1, 99, 100, 12345, 99999999]) {
      const typed = (minor / 100).toFixed(2)
      expect(parseMoney(typed)).toBe(minor)
    }
  })
})
