import { describe, it, expect } from 'vitest'

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

describe('easeOutCubic', () => {
  it('returns 0 at t=0', () => {
    expect(easeOutCubic(0)).toBe(0)
  })
  it('returns 1 at t=1', () => {
    expect(easeOutCubic(1)).toBe(1)
  })
  it('is monotonically increasing', () => {
    const values = [0, 0.25, 0.5, 0.75, 1].map(easeOutCubic)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!)
    }
  })
})
