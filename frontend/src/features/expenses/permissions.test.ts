import { describe, expect, it } from 'vitest'
import { canModifyExpense } from './permissions'

const active = { myRole: 'MEMBER', status: 'ACTIVE' } as const
const owner = { myRole: 'OWNER', status: 'ACTIVE' } as const

describe('canModifyExpense', () => {
  it('lets the creator change their own expense', () => {
    expect(canModifyExpense({ createdBy: 'me' }, 'me', active)).toBe(true)
  })

  it("does not let an ordinary member change someone else's expense", () => {
    expect(canModifyExpense({ createdBy: 'other' }, 'me', active)).toBe(false)
  })

  it('lets the owner of the group moderate any expense', () => {
    expect(canModifyExpense({ createdBy: 'other' }, 'me', owner)).toBe(true)
  })

  it('lets nobody change anything in an archived group, not even the owner', () => {
    expect(canModifyExpense({ createdBy: 'me' }, 'me', { myRole: 'OWNER', status: 'ARCHIVED' })).toBe(false)
  })

  it('lets nobody change anything before it is known who is asking', () => {
    expect(canModifyExpense({ createdBy: 'me' }, undefined, owner)).toBe(false)
  })
})
