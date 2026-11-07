import { describe, expect, it } from 'vitest'
import { member } from '@/test/fixtures'
import { memberNames } from './queries'

describe('memberNames', () => {
  it('shows the full name, falling back to the username', () => {
    const nameOf = memberNames([member({ userId: 'a', fullName: 'Ahmed B.', username: 'ahmed' }), member({ userId: 'b', fullName: '', username: 'hamza' })])

    expect(nameOf('a')).toBe('Ahmed B.')
    expect(nameOf('b')).toBe('hamza')
  })

  it('never shows a raw id: an unknown member, or a list not loaded yet, shows as "?"', () => {
    expect(memberNames([member({ userId: 'a' })])('ghost-id-123')).toBe('?')
    expect(memberNames(undefined)('a')).toBe('?')
  })
})
