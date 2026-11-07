import { describe, expect, it } from 'vitest'
import { amountChange } from './queries'

describe('amountChange', () => {
  it('returns the amount before and after when the line carries both and they differ', () => {
    expect(amountChange({ amountMinor: 9000 }, { amountMinor: 12000 })).toEqual([9000, 12000])
  })

  it('says nothing when nothing changed, or when a side is missing (a creation has no "before")', () => {
    expect(amountChange({ amountMinor: 100 }, { amountMinor: 100 })).toBeNull()
    expect(amountChange(null, { amountMinor: 100 })).toBeNull()
    expect(amountChange({ amountMinor: 100 }, null)).toBeNull()
    expect(amountChange({}, {})).toBeNull()
  })

  it('ignores an amount that is not a number', () => {
    expect(amountChange({ amountMinor: '100' }, { amountMinor: 200 })).toBeNull()
  })
})
