import { describe, it, expect } from 'vitest'
import { calcSessionXP, getStreakMultiplier, xpToLevel, levelToXp } from '../utils/xp'

describe('calcSessionXP', () => {
  it('awards 1 XP/min for sessions under 25 min', () => {
    expect(calcSessionXP(0)).toBe(0)
    expect(calcSessionXP(60)).toBe(1)       // 1 min
    expect(calcSessionXP(600)).toBe(10)     // 10 min
    expect(calcSessionXP(1440)).toBe(24)    // 24 min
  })

  it('awards exactly 25 XP at the 25-min threshold', () => {
    expect(calcSessionXP(1500)).toBe(25)    // 25 min exactly
  })

  it('awards super-linear XP for sessions over 25 min', () => {
    // Note: spec reference table shows 71/171/263, but those are rounded estimates.
    // The correct values from floor(mins^1.5 / 5) are 70/170/262.
    expect(calcSessionXP(3000)).toBe(70)    // 50 min
    expect(calcSessionXP(5400)).toBe(170)   // 90 min
    expect(calcSessionXP(7200)).toBe(262)   // 120 min
  })

  it('floors to integer', () => {
    expect(Number.isInteger(calcSessionXP(1800))).toBe(true) // 30 min
  })
})

describe('xpToLevel / levelToXp round-trip', () => {
  it('levelToXp(xpToLevel(xp)) <= xp for levels 0–10', () => {
    for (let level = 0; level <= 10; level++) {
      const xp = levelToXp(level)
      expect(xpToLevel(xp)).toBe(level)
      // one XP below the threshold should still be the previous level
      if (level > 0) expect(xpToLevel(xp - 1)).toBe(level - 1)
    }
  })
})

describe('getStreakMultiplier', () => {
  it('returns 1 for streaks 0-2', () => {
    expect(getStreakMultiplier(0)).toBe(1)
    expect(getStreakMultiplier(1)).toBe(1)
    expect(getStreakMultiplier(2)).toBe(1)
  })

  it('returns 1.2 for streaks 3-6', () => {
    expect(getStreakMultiplier(3)).toBe(1.2)
    expect(getStreakMultiplier(6)).toBe(1.2)
  })

  it('returns 1.5 for streaks 7-29', () => {
    expect(getStreakMultiplier(7)).toBe(1.5)
    expect(getStreakMultiplier(29)).toBe(1.5)
  })

  it('returns 2 for streaks 30+', () => {
    expect(getStreakMultiplier(30)).toBe(2)
    expect(getStreakMultiplier(100)).toBe(2)
  })
})
