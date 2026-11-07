import { describe, expect, it } from 'vitest'
import { formatCodeInput, parseInvitationInput } from './code'

const LINK_SECRET = 'q3Vn_8xTkL2m-ZpR7sYwB1aCdEfGhJkLmNoPqRsTuVw'

describe('parseInvitationInput', () => {
  it('normalises a code like the server does: no dash, no spaces, upper case', () => {
    expect(parseInvitationInput('abcd-efgh')).toBe('ABCDEFGH')
    expect(parseInvitationInput('ABCD EFGH')).toBe('ABCDEFGH')
    expect(parseInvitationInput('  abcdefgh  ')).toBe('ABCDEFGH')
    expect(parseInvitationInput('a b c d - e f g h')).toBe('ABCDEFGH')
  })

  it('refuses what cannot be a code: wrong length, or letters and digits the codes never use', () => {
    expect(parseInvitationInput('')).toBeNull()
    expect(parseInvitationInput('   ')).toBeNull()
    expect(parseInvitationInput('ABCD-EFG')).toBeNull()      // 7 symbols
    expect(parseInvitationInput('AB')).toBeNull()
    for (const confusing of ['0', '1', 'O', 'I']) {
      expect(parseInvitationInput(`ABCD-EFG${confusing}`), confusing).toBeNull()
    }
  })

  it('keeps a long link secret exactly as it is (it is opaque and case-sensitive)', () => {
    expect(parseInvitationInput(LINK_SECRET)).toBe(LINK_SECRET)
  })

  it('refuses text with symbols a secret never contains', () => {
    expect(parseInvitationInput('!!!!!!!!!!!!!!!!')).toBeNull()
    expect(parseInvitationInput('ABCD-EFGH!')).toBeNull()
  })

  it('finds the invitation inside a pasted link, whatever the site, and ignores the query string', () => {
    expect(parseInvitationInput(`https://qisma.app/join/${LINK_SECRET}`)).toBe(LINK_SECRET)
    expect(parseInvitationInput(`http://localhost:5173/join/${LINK_SECRET}?utm=x#top`)).toBe(LINK_SECRET)
    expect(parseInvitationInput('https://qisma.app/join/ABCD-EFGH')).toBe('ABCDEFGH')
    expect(parseInvitationInput('Join us: https://qisma.app/join/abcdefgh please')).toBe('ABCDEFGH')
  })

  it('refuses a link that is not an invitation', () => {
    expect(parseInvitationInput('https://qisma.app/groups/abc')).toBeNull()
  })
})

describe('formatCodeInput', () => {
  it('shows a code as ABCD-EFGH while it is typed', () => {
    expect(formatCodeInput('abc')).toBe('ABC')
    expect(formatCodeInput('abcd')).toBe('ABCD')
    expect(formatCodeInput('abcde')).toBe('ABCD-E')
    expect(formatCodeInput('abcdefgh')).toBe('ABCD-EFGH')
    expect(formatCodeInput('abcd efgh')).toBe('ABCD-EFGH')
    expect(formatCodeInput('ABCD-EFGH')).toBe('ABCD-EFGH')
  })

  it('leaves pasted links and long secrets alone', () => {
    expect(formatCodeInput(LINK_SECRET)).toBe(LINK_SECRET)
    expect(formatCodeInput('https://qisma.app/join/ABCD-EFGH')).toBe('https://qisma.app/join/ABCD-EFGH')
  })
})
