import { describe, expect, it } from 'vitest'
import { allocateEqual, allocatePercentage } from './split'
import { EQUAL_GOLDEN, PERCENTAGE_GOLDEN } from './split.golden'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`)
const shares = (lines: { shareMinor: number }[]) => lines.map((l) => l.shareMinor)

describe('allocateEqual: the cases the server itself is tested with', () => {
  it('splits 300.00 between three into 100.00 each', () => {
    expect(shares(allocateEqual(30000, ids(3)))).toEqual([10000, 10000, 10000])
  })

  it('gives the leftover centime to the first participants: 100.00 between three is 33.34, 33.33, 33.33', () => {
    expect(shares(allocateEqual(10000, ids(3)))).toEqual([3334, 3333, 3333])
  })

  it('gives one leftover centime to each of the first participants when there are several', () => {
    expect(shares(allocateEqual(10, ids(4)))).toEqual([3, 3, 2, 2])
    expect(shares(allocateEqual(11, ids(4)))).toEqual([3, 3, 3, 2])
  })

  it('works for one person, and for an amount smaller than the number of people', () => {
    expect(shares(allocateEqual(12345, ids(1)))).toEqual([12345])
    expect(shares(allocateEqual(2, ids(5)))).toEqual([1, 1, 0, 0, 0])
  })

  it('keeps the order of the participants and carries no percentage', () => {
    expect(allocateEqual(100, ['z', 'a', 'm'])).toEqual([
      { userId: 'z', shareMinor: 34, percentageBp: null },
      { userId: 'a', shareMinor: 33, percentageBp: null },
      { userId: 'm', shareMinor: 33, percentageBp: null },
    ])
  })

  it('refuses what the server refuses', () => {
    expect(() => allocateEqual(0, ids(2))).toThrow(RangeError)
    expect(() => allocateEqual(-5, ids(2))).toThrow(RangeError)
    expect(() => allocateEqual(10.5, ids(2))).toThrow(RangeError)
    expect(() => allocateEqual(100, [])).toThrow(RangeError)
  })
})

describe('allocatePercentage: the cases the server itself is tested with', () => {
  it('splits 400.00 as 50%, 30%, 20% into 200.00, 120.00, 80.00', () => {
    const lines = allocatePercentage(40000, [
      { userId: 'a', percentageBp: 5000 }, { userId: 'b', percentageBp: 3000 }, { userId: 'c', percentageBp: 2000 },
    ])

    expect(shares(lines)).toEqual([20000, 12000, 8000])
    expect(lines.map((l) => l.percentageBp)).toEqual([5000, 3000, 2000])
  })

  it('gives the leftover centime to the biggest remainder: 100.01 as 33.33%, 33.33%, 33.34%', () => {
    const lines = allocatePercentage(10001, [
      { userId: 'a', percentageBp: 3333 }, { userId: 'b', percentageBp: 3333 }, { userId: 'c', percentageBp: 3334 },
    ])

    expect(shares(lines)).toEqual([3333, 3333, 3335])
  })

  it('breaks a tie in favour of the earlier participant', () => {
    expect(shares(allocatePercentage(1, [{ userId: 'a', percentageBp: 5000 }, { userId: 'b', percentageBp: 5000 }]))).toEqual([1, 0])
  })

  it('gives nothing to someone at 0%, and everything to someone alone at 100%', () => {
    expect(shares(allocatePercentage(999, [{ userId: 'a', percentageBp: 0 }, { userId: 'b', percentageBp: 10000 }]))).toEqual([0, 999])
    expect(shares(allocatePercentage(999, [{ userId: 'a', percentageBp: 10000 }]))).toEqual([999])
  })

  it('does not lose a centime at the largest amount the API accepts, where 64-bit float maths would', () => {
    const big = 1_000_000_000_000
    // big x 9999 = 9 999 000 000 000 000, beyond Number.MAX_SAFE_INTEGER (9 007 199 254 740 991)
    expect(big * 9999).toBeGreaterThan(Number.MAX_SAFE_INTEGER)

    const lines = allocatePercentage(big, [{ userId: 'a', percentageBp: 9999 }, { userId: 'b', percentageBp: 1 }])

    expect(shares(lines)).toEqual([999_900_000_000, 100_000_000])
    expect(lines.reduce((sum, l) => sum + l.shareMinor, 0)).toBe(big)
  })

  it('refuses what the server refuses', () => {
    const two = (a: number, b: number) => [{ userId: 'a', percentageBp: a }, { userId: 'b', percentageBp: b }]
    expect(() => allocatePercentage(100, two(5000, 4999))).toThrow(/total exactly 100%/)
    expect(() => allocatePercentage(100, two(5000, 5001))).toThrow(RangeError)
    expect(() => allocatePercentage(100, two(-1, 10001))).toThrow(RangeError)
    expect(() => allocatePercentage(100, two(10001, -1))).toThrow(RangeError)
    expect(() => allocatePercentage(100, two(5000.5, 4999.5))).toThrow(RangeError)
    expect(() => allocatePercentage(0, two(5000, 5000))).toThrow(RangeError)
    expect(() => allocatePercentage(100, [])).toThrow(RangeError)
  })
})

describe('against an independent implementation (generated with Python integers from the server algorithm)', () => {
  it(`agrees on all ${EQUAL_GOLDEN.length} equal splits`, () => {
    for (const { total, n, shares: expected } of EQUAL_GOLDEN) {
      expect(shares(allocateEqual(total, ids(n))), `total ${total}, ${n} participants`).toEqual(expected)
    }
  })

  it(`agrees on all ${PERCENTAGE_GOLDEN.length} percentage splits`, () => {
    for (const { total, bps, shares: expected } of PERCENTAGE_GOLDEN) {
      const lines = allocatePercentage(total, bps.map((percentageBp, i) => ({ userId: `u${i}`, percentageBp })))
      expect(shares(lines), `total ${total}, bp ${bps.join('/')}`).toEqual(expected)
    }
  })
})

describe('the invariant that matters most: the shares always add up to the total, to the centime', () => {
  it('holds for random equal and percentage splits', () => {
    let seed = 7
    const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647
    for (let round = 0; round < 3000; round++) {
      const total = 1 + Math.floor(random() * 1_000_000_000_000)
      const n = 1 + Math.floor(random() * 50)
      expect(allocateEqual(total, ids(n)).reduce((s, l) => s + l.shareMinor, 0)).toBe(total)

      const cuts = Array.from({ length: n - 1 }, () => Math.floor(random() * 10001)).sort((a, b) => a - b)
      const bps = [...cuts, 10000].map((cut, i) => cut - (i === 0 ? 0 : [...cuts, 10000][i - 1]))
      const lines = allocatePercentage(total, bps.map((percentageBp, i) => ({ userId: `u${i}`, percentageBp })))
      expect(lines.reduce((s, l) => s + l.shareMinor, 0), `round ${round}`).toBe(total)
      lines.forEach((line) => expect(line.shareMinor).toBeGreaterThanOrEqual(0))
    }
  })
})
