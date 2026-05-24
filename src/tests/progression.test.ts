import { describe, it, expect } from 'vitest'
import {
  getRankFromXP,
  getMasteryFromXP,
  getXPToNextRank,
  RANK_TIERS,
  MASTERY_TIERS,
} from '../utils/progression'

describe('RANK_TIERS', () => {
  it('has 30 entries (10 tiers × 3 sub-levels)', () => {
    expect(RANK_TIERS.length).toBe(30)
  })

  it('first rank starts at 0 XP', () => {
    expect(RANK_TIERS[0].minXP).toBe(0)
  })

  it('thresholds are strictly ascending', () => {
    for (let i = 1; i < RANK_TIERS.length; i++) {
      expect(RANK_TIERS[i].minXP).toBeGreaterThan(RANK_TIERS[i - 1].minXP)
    }
  })
})

describe('MASTERY_TIERS', () => {
  it('has 5 entries', () => {
    expect(MASTERY_TIERS.length).toBe(5)
  })

  it('first mastery tier starts at 0 XP', () => {
    expect(MASTERY_TIERS[0].minXP).toBe(0)
  })
})

describe('getRankFromXP', () => {
  it('returns Wanderer I for 0 XP', () => {
    const r = getRankFromXP(0)
    expect(r.tierName).toBe('Wanderer')
    expect(r.subLevel).toBe(1)
    expect(r.rankIndex).toBe(0)
  })

  it('returns correct rank at exact threshold', () => {
    const threshold = RANK_TIERS[1].minXP
    const r = getRankFromXP(threshold)
    expect(r.rankIndex).toBe(1)
  })

  it('returns Luminary III at very high XP', () => {
    const r = getRankFromXP(999_999_999)
    expect(r.tierName).toBe('Luminary')
    expect(r.subLevel).toBe(3)
    expect(r.rankIndex).toBe(29)
  })
})

describe('getMasteryFromXP', () => {
  it('returns Ember for 0 subject XP', () => {
    expect(getMasteryFromXP(0).name).toBe('Ember')
  })

  it('returns Inferno for 15000+ subject XP', () => {
    expect(getMasteryFromXP(15000).name).toBe('Inferno')
    expect(getMasteryFromXP(999999).name).toBe('Inferno')
  })
})

describe('getXPToNextRank', () => {
  it('returns positive XP needed when not at max rank', () => {
    expect(getXPToNextRank(0)).toBeGreaterThan(0)
  })

  it('returns 0 when already at Luminary III', () => {
    expect(getXPToNextRank(999_999_999)).toBe(0)
  })
})
