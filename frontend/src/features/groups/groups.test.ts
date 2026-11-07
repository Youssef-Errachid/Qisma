import { describe, expect, it } from 'vitest'
import { group } from '@/test/fixtures'
import { sortGroups } from './queries'
import { createGroupSchema } from './schemas'

describe('sortGroups', () => {
  it('puts active groups first, newest first, then the archived ones', () => {
    const sorted = sortGroups([
      group({ id: 'old-archived', status: 'ARCHIVED', createdAt: '2026-01-01T00:00:00Z' }),
      group({ id: 'old', createdAt: '2026-02-01T00:00:00Z' }),
      group({ id: 'new-archived', status: 'ARCHIVED', createdAt: '2026-10-01T00:00:00Z' }),
      group({ id: 'new', createdAt: '2026-11-01T00:00:00Z' }),
    ])

    expect(sorted.map((g) => g.id)).toEqual(['new', 'old', 'new-archived', 'old-archived'])
  })

  it('does not modify the list it was given', () => {
    const input = [group({ id: 'a', createdAt: '2026-01-01T00:00:00Z' }), group({ id: 'b', createdAt: '2026-02-01T00:00:00Z' })]
    sortGroups(input)
    expect(input.map((g) => g.id)).toEqual(['a', 'b'])
  })
})

describe('createGroupSchema', () => {
  const valid = { name: 'House 2026', description: '', currency: 'MAD' }

  it('accepts a valid form and trims the text', () => {
    const result = createGroupSchema.safeParse({ name: '  House 2026 ', description: '  shared flat ', currency: 'MAD' })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ name: 'House 2026', description: 'shared flat', currency: 'MAD' })
  })

  it('needs a name of at most 80 characters', () => {
    expect(createGroupSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false)
    expect(createGroupSchema.safeParse({ ...valid, name: 'x'.repeat(81) }).success).toBe(false)
    expect(createGroupSchema.safeParse({ ...valid, name: 'x'.repeat(80) }).success).toBe(true)
  })

  it('limits the description to 500 characters', () => {
    expect(createGroupSchema.safeParse({ ...valid, description: 'x'.repeat(501) }).success).toBe(false)
    expect(createGroupSchema.safeParse({ ...valid, description: 'x'.repeat(500) }).success).toBe(true)
  })

  it('only offers the currencies of the menu', () => {
    expect(createGroupSchema.safeParse({ ...valid, currency: 'XYZ' }).success).toBe(false)
    expect(createGroupSchema.safeParse({ ...valid, currency: 'eur' }).success).toBe(false)
    expect(createGroupSchema.safeParse({ ...valid, currency: 'EUR' }).success).toBe(true)
  })
})
