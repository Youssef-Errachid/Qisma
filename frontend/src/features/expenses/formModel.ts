import { allocateEqual, allocatePercentage, type ShareLine, TOTAL_BP } from '@/lib/split'
import { bpToInput, minorToInput, parseMoney, parsePercent } from '@/lib/money'
import type { ExpenseResponse, ParticipantInput, SplitMethod } from '@/types/api'

/** What is typed for one member: whether they take part and, for custom and percentage splits, their amount or percentage. */
export interface Draft {
  selected: boolean
  value: string
}
export type Drafts = Record<string, Draft>

export type SplitIssue =
  | { kind: 'AMOUNT_REQUIRED' }
  | { kind: 'NO_PARTICIPANTS' }
  | { kind: 'VALUE_MISSING'; userId: string }
  | { kind: 'VALUE_INVALID'; userId: string }
  | { kind: 'CUSTOM_MISMATCH'; remainingMinor: number }
  | { kind: 'PERCENT_MISMATCH'; remainingBp: number }

export interface SplitPlan {
  /** What stops the form from being sent. Empty means the split is valid. */
  issues: SplitIssue[]
  /** The share of every participant, in the order they will be sent. Empty while there are issues. */
  shares: ShareLine[]
  /** Custom: what is still to allocate, in minor units (negative when too much). Percentage: basis points. Equal: null. */
  remaining: number | null
}

interface PlanArgs {
  method: SplitMethod
  /** the typed amount, already parsed, or null when it is not a valid amount */
  amountMinor: number | null
  /** the active members, in the order that decides who gets the leftover centime */
  memberIds: readonly string[]
  drafts: Drafts
  digits: number
}

/** Checks what was typed exactly as the server will, and computes the shares it will store. Pure. */
export function planSplit({ method, amountMinor, memberIds, drafts, digits }: PlanArgs): SplitPlan {
  const selected = memberIds.filter((id) => drafts[id]?.selected)
  if (amountMinor === null) {
    return { issues: [{ kind: 'AMOUNT_REQUIRED' }], shares: [], remaining: null }
  }
  if (selected.length === 0) {
    return { issues: [{ kind: 'NO_PARTICIPANTS' }], shares: [], remaining: method === 'CUSTOM' ? amountMinor : method === 'PERCENTAGE' ? TOTAL_BP : null }
  }

  if (method === 'EQUAL') {
    return { issues: [], shares: allocateEqual(amountMinor, selected), remaining: null }
  }

  const issues: SplitIssue[] = []

  if (method === 'CUSTOM') {
    const lines: ShareLine[] = []
    let sum = 0
    for (const userId of selected) {
      const text = drafts[userId].value
      if (text.trim() === '') {
        issues.push({ kind: 'VALUE_MISSING', userId })
        continue
      }
      const shareMinor = parseMoney(text, digits, { allowZero: true })
      if (shareMinor === null) {
        issues.push({ kind: 'VALUE_INVALID', userId })
        continue
      }
      sum += shareMinor
      lines.push({ userId, shareMinor, percentageBp: null })
    }
    const remaining = amountMinor - sum
    if (issues.length === 0 && remaining !== 0) {
      issues.push({ kind: 'CUSTOM_MISMATCH', remainingMinor: remaining })
    }
    return { issues, shares: issues.length === 0 ? lines : [], remaining }
  }

  const percentages: Array<{ userId: string; percentageBp: number }> = []
  let bpSum = 0
  for (const userId of selected) {
    const text = drafts[userId].value
    if (text.trim() === '') {
      issues.push({ kind: 'VALUE_MISSING', userId })
      continue
    }
    const percentageBp = parsePercent(text)
    if (percentageBp === null) {
      issues.push({ kind: 'VALUE_INVALID', userId })
      continue
    }
    bpSum += percentageBp
    percentages.push({ userId, percentageBp })
  }
  const remainingBp = TOTAL_BP - bpSum
  if (issues.length === 0 && remainingBp !== 0) {
    issues.push({ kind: 'PERCENT_MISMATCH', remainingBp })
  }
  return { issues, shares: issues.length === 0 ? allocatePercentage(amountMinor, percentages) : [], remaining: remainingBp }
}

/** The participants as the API wants them: only the field that belongs to the method. */
export function toParticipantInputs(method: SplitMethod, shares: readonly ShareLine[]): ParticipantInput[] {
  return shares.map((share) => {
    if (method === 'CUSTOM') return { userId: share.userId, shareMinor: share.shareMinor }
    if (method === 'PERCENTAGE') return { userId: share.userId, percentageBp: share.percentageBp ?? 0 }
    return { userId: share.userId }
  })
}

/** Everyone starts selected, with nothing typed: the usual case is an equal split between all. */
export function allSelected(memberIds: readonly string[]): Drafts {
  return Object.fromEntries(memberIds.map((id) => [id, { selected: true, value: '' }]))
}

/**
 * "Split equally" for the custom and percentage methods: types into each selected member's box the equal share
 * (amounts) or the equal percentage, so the user only has to adjust a few.
 */
export function fillEqually(method: SplitMethod, amountMinor: number | null, memberIds: readonly string[], drafts: Drafts, digits: number): Drafts {
  const selected = memberIds.filter((id) => drafts[id]?.selected)
  const next: Drafts = { ...drafts }
  if (selected.length === 0 || method === 'EQUAL') {
    return next
  }
  if (method === 'CUSTOM') {
    if (amountMinor === null) {
      return next
    }
    allocateEqual(amountMinor, selected).forEach((line) => {
      next[line.userId] = { selected: true, value: minorToInput(line.shareMinor, digits) }
    })
  } else {
    allocateEqual(TOTAL_BP, selected).forEach((line) => {
      next[line.userId] = { selected: true, value: bpToInput(line.shareMinor) }
    })
  }
  return next
}

export interface EditStart {
  drafts: Drafts
  /** people in the expense who are no longer active members: the server would refuse them, so they are left out */
  leftOut: string[]
}

/** The drafts that reproduce an existing expense, to start editing it. */
export function draftsFromExpense(expense: Pick<ExpenseResponse, 'splitMethod' | 'shares'>, memberIds: readonly string[], digits: number): EditStart {
  const drafts: Drafts = Object.fromEntries(memberIds.map((id) => [id, { selected: false, value: '' }]))
  const leftOut: string[] = []
  for (const share of expense.shares) {
    if (!(share.userId in drafts)) {
      leftOut.push(share.userId)
      continue
    }
    const value =
      expense.splitMethod === 'CUSTOM' ? minorToInput(share.shareMinor, digits)
      : expense.splitMethod === 'PERCENTAGE' ? bpToInput(share.percentageBp ?? 0)
      : ''
    drafts[share.userId] = { selected: true, value }
  }
  return { drafts, leftOut }
}
