import { describe, it, expect } from 'vitest'
import { bestWeek } from '../utils/stats'

describe('bestWeek', () => {
  it('returns zeros for empty input', () => {
    const r = bestWeek(new Map())
    expect(r.bestWeekMins).toBe(0)
    expect(r.bestWeekStart).toBe('')
  })

  it('handles a single day', () => {
    const r = bestWeek(new Map([['2026-05-01', 90]]))
    expect(r.bestWeekMins).toBe(90)
    expect(r.bestWeekStart).toBe('2026-05-01')
  })

  it('finds the best 7-day window across a gap', () => {
    const map = new Map([
      ['2026-05-01', 60],
      ['2026-05-02', 60],
      ['2026-05-08', 200],
      ['2026-05-09', 200],
    ])
    const r = bestWeek(map)
    // May 8 and May 9 are within a 7-day window (< 7 days apart)
    expect(r.bestWeekMins).toBe(400)
    expect(r.bestWeekStart).toBe('2026-05-08')
  })

  it('does not merge days 7+ days apart into one window', () => {
    const map = new Map([
      ['2026-05-01', 100],
      ['2026-05-09', 100],  // exactly 8 days later — outside a 7-day window
    ])
    const r = bestWeek(map)
    expect(r.bestWeekMins).toBe(100)
  })
})
