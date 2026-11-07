/**
 * How an expense is cut between its participants. This is the SAME algorithm as the server's (EqualSplitStrategy and
 * PercentageSplitStrategy), so the preview shown while typing is exactly what the server will store: the server always
 * recomputes the shares itself and never trusts these. All amounts are integers in minor units.
 */

export interface ShareLine {
  userId: string
  shareMinor: number
  /** only for percentage splits; 10000 = 100% */
  percentageBp: number | null
}

export const TOTAL_BP = 10_000

/**
 * Equal split: everyone gets the whole part of total / n, and the leftover minor units (fewer than n) go one by one to
 * the FIRST participants, in the order given. 100.00 between three is 33.34, 33.33, 33.33.
 */
export function allocateEqual(totalMinor: number, userIds: readonly string[]): ShareLine[] {
  if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0) {
    throw new RangeError('The total must be a positive whole number of minor units')
  }
  const n = userIds.length
  if (n === 0) {
    throw new RangeError('At least one participant is required')
  }
  const base = Math.floor(totalMinor / n)
  const remainder = totalMinor % n
  return userIds.map((userId, index) => ({ userId, shareMinor: base + (index < remainder ? 1 : 0), percentageBp: null }))
}

export interface PercentageInput {
  userId: string
  /** 0 to 10000, summing to exactly 10000 over all the participants */
  percentageBp: number
}

/**
 * Percentage split: each share is the whole part of total x percentage, and the leftover minor units go to the
 * participants whose division left the biggest remainder (ties: the earlier participant). BigInt is not a luxury here:
 * 1 000 000 000 000 x 9 999 is bigger than the largest integer a JavaScript number holds exactly.
 */
export function allocatePercentage(totalMinor: number, inputs: readonly PercentageInput[]): ShareLine[] {
  if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0) {
    throw new RangeError('The total must be a positive whole number of minor units')
  }
  if (inputs.length === 0) {
    throw new RangeError('At least one participant is required')
  }
  let bpSum = 0
  for (const { percentageBp } of inputs) {
    if (!Number.isInteger(percentageBp) || percentageBp < 0 || percentageBp > TOTAL_BP) {
      throw new RangeError('A percentage must be between 0 and 100%')
    }
    bpSum += percentageBp
  }
  if (bpSum !== TOTAL_BP) {
    throw new RangeError(`Percentages must total exactly 100%, they total ${bpSum} basis points`)
  }

  const amount = BigInt(totalMinor)
  const divisor = BigInt(TOTAL_BP)
  const floors: number[] = []
  const remainders: number[] = []
  for (const { percentageBp } of inputs) {
    const product = amount * BigInt(percentageBp)
    floors.push(Number(product / divisor))
    remainders.push(Number(product % divisor))
  }
  const leftover = totalMinor - floors.reduce((sum, share) => sum + share, 0)

  const order = inputs.map((_, index) => index).sort((a, b) => remainders[b] - remainders[a] || a - b)
  for (let k = 0; k < leftover; k++) {
    floors[order[k]] += 1
  }
  return inputs.map((input, index) => ({ userId: input.userId, shareMinor: floors[index], percentageBp: input.percentageBp }))
}
