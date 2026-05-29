import { describe, it, expect } from 'vitest'
import {
  bestWeek,
  calcMinsPerDay,
  calcKPIs,
  calcPeakHour,
  calcSubjectMins,
  calcSessionHistogram,
  calcConsistency,
} from '../utils/stats'
import type { SessionEntry } from '../types'

// ─── shared helper ─────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<SessionEntry> = {}): SessionEntry {
  return {
    id:           'test-id',
    type:         'work',
    completedAt:  '2026-05-28T10:00:00.000Z',
    xp:           25,
    subjectId:    null,
    tagId:        null,
    durationSecs: 1500,   // 25 min
    ...overrides,
  }
}

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

// ─── calcMinsPerDay ────────────────────────────────────────────────────────────

describe('calcMinsPerDay', () => {
  it('returns empty map for empty input', () => {
    expect(calcMinsPerDay([])).toEqual(new Map())
  })

  it('ignores non-work sessions', () => {
    const s = makeSession({ type: 'shortBreak' })
    expect(calcMinsPerDay([s]).size).toBe(0)
  })

  it('accumulates minutes for the same date', () => {
    const s1 = makeSession({ durationSecs: 1500, completedAt: '2026-05-28T09:00:00.000Z' })
    const s2 = makeSession({ durationSecs: 1500, completedAt: '2026-05-28T11:00:00.000Z' })
    const map = calcMinsPerDay([s1, s2])
    expect([...map.values()][0]).toBe(50)
  })
})

// ─── calcKPIs ──────────────────────────────────────────────────────────────────

describe('calcKPIs', () => {
  it('returns zeros for empty inputs', () => {
    const range = { from: new Date('2026-05-01'), to: new Date('2026-05-28') }
    const r = calcKPIs([], range, [])
    expect(r.totalMins).toBe(0)
    expect(r.sessionCount).toBe(0)
    expect(r.avgSessionMins).toBe(0)
    expect(r.longestSessionMins).toBe(0)
    expect(r.prevTotalMins).toBe(0)
    expect(r.prevSessionCount).toBe(0)
  })

  it('computes totals and averages correctly', () => {
    const range = { from: new Date('2026-05-01'), to: new Date('2026-05-28') }
    const sessions = [
      makeSession({ durationSecs: 1500, completedAt: '2026-05-10T10:00:00.000Z' }),  // 25 min
      makeSession({ durationSecs: 3000, completedAt: '2026-05-15T10:00:00.000Z' }),  // 50 min
    ]
    const r = calcKPIs(sessions, range, [])
    expect(r.totalMins).toBe(75)
    expect(r.sessionCount).toBe(2)
    expect(r.avgSessionMins).toBe(38)
    expect(r.longestSessionMins).toBe(50)
    expect(r.prevTotalMins).toBe(0)
  })
})

// ─── calcPeakHour ─────────────────────────────────────────────────────────────

describe('calcPeakHour', () => {
  it('returns hour -1 and label "—" for empty input', () => {
    const r = calcPeakHour([])
    expect(r.hour).toBe(-1)
    expect(r.label).toBe('—')
  })

  it('finds the hour with the most minutes', () => {
    // Use local noon vs local 8pm to avoid timezone ambiguity
    const now = new Date('2026-05-28')
    const morningIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 30).toISOString()
    const eveningIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0).toISOString()
    const morning = makeSession({ completedAt: morningIso, durationSecs: 1500 })
    const evening  = makeSession({ completedAt: eveningIso, durationSecs: 3600 })
    const r = calcPeakHour([morning, evening])
    // 60 min at local hour 19 > 25 min at local hour 9
    expect(r.hour).toBe(19)
  })

  it('wraps label at hour 23 to 0:00 not 24:00', () => {
    const now = new Date('2026-05-28')
    const lateIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 0).toISOString()
    const s = makeSession({ completedAt: lateIso })
    const r = calcPeakHour([s])
    expect(r.label).toBe('23:00 – 0:00')
  })
})

// ─── calcSubjectMins ──────────────────────────────────────────────────────────

describe('calcSubjectMins', () => {
  const range = { from: new Date('2026-01-01'), to: new Date('2026-12-31') }

  it('returns empty array for no subjects', () => {
    expect(calcSubjectMins([], range)).toEqual([])
  })

  it('skips sessions without a subjectId', () => {
    expect(calcSubjectMins([makeSession({ subjectId: null })], range)).toEqual([])
  })

  it('aggregates minutes per subject', () => {
    const s1 = makeSession({ subjectId: 'a', durationSecs: 1500 })
    const s2 = makeSession({ subjectId: 'b', durationSecs: 3000 })
    const s3 = makeSession({ subjectId: 'a', durationSecs: 1500 })
    const r = calcSubjectMins([s1, s2, s3], range)
    const aEntry = r.find(x => x.subjectId === 'a')
    const bEntry = r.find(x => x.subjectId === 'b')
    expect(aEntry?.mins).toBe(50)
    expect(bEntry?.mins).toBe(50)
  })
})

// ─── calcSessionHistogram ─────────────────────────────────────────────────────

describe('calcSessionHistogram', () => {
  const BUCKETS = [
    { label: '0–25',   max: 25 },
    { label: '26–50',  max: 50 },
    { label: '51+',    max: Infinity },
  ] as const

  it('returns all-zero counts for empty sessions', () => {
    const r = calcSessionHistogram([], BUCKETS)
    expect(r.every(b => b.count === 0)).toBe(true)
  })

  it('places a 25-min session in the first bucket', () => {
    const r = calcSessionHistogram([makeSession({ durationSecs: 1500 })], BUCKETS)
    expect(r[0]?.count).toBe(1)
    expect(r[1]?.count).toBe(0)
  })

  it('marks the tallest bar as isPeak', () => {
    const sessions = [
      makeSession({ durationSecs: 1500 }),
      makeSession({ durationSecs: 1500 }),
      makeSession({ durationSecs: 3600 }),
    ]
    const r = calcSessionHistogram(sessions, BUCKETS)
    expect(r[0]?.isPeak).toBe(true)
    expect(r[1]?.isPeak).toBe(false)
  })

  it('includes height field (0–100)', () => {
    const r = calcSessionHistogram([makeSession({ durationSecs: 1500 })], BUCKETS)
    r.forEach(b => {
      expect(b.height).toBeGreaterThanOrEqual(0)
      expect(b.height).toBeLessThanOrEqual(100)
    })
  })
})

// ─── calcConsistency ──────────────────────────────────────────────────────────

describe('calcConsistency', () => {
  it('returns zeros for empty sessions', () => {
    const today = new Date('2026-05-28')
    const r = calcConsistency([], today)
    expect(r.activeDays28).toBe(0)
    expect(r.pct).toBe(0)
    expect(r.longestRun).toBe(0)
  })

  it('counts active days correctly', () => {
    const today = new Date('2026-05-28')
    // Use local midnight to avoid timezone issues
    const makeDateIso = (y: number, m: number, d: number) =>
      new Date(y, m - 1, d, 10, 0, 0).toISOString()
    const sessions = [
      makeSession({ completedAt: makeDateIso(2026, 5, 28) }),
      makeSession({ completedAt: makeDateIso(2026, 5, 27) }),
      makeSession({ completedAt: makeDateIso(2026, 4, 29) }),  // outside 28-day window (April 29 = 29 days ago)
    ]
    const r = calcConsistency(sessions, today)
    expect(r.activeDays28).toBe(2)
  })

  it('computes longest run correctly', () => {
    const today = new Date('2026-05-28')
    const makeDateIso = (y: number, m: number, d: number) =>
      new Date(y, m - 1, d, 10, 0, 0).toISOString()
    const sessions = [
      makeSession({ completedAt: makeDateIso(2026, 5, 28) }),
      makeSession({ completedAt: makeDateIso(2026, 5, 27) }),
      makeSession({ completedAt: makeDateIso(2026, 5, 26) }),
      makeSession({ completedAt: makeDateIso(2026, 5, 24) }),  // gap on May 25
    ]
    const r = calcConsistency(sessions, today)
    expect(r.longestRun).toBe(3)
  })

  it('ignores non-work sessions', () => {
    const today = new Date('2026-05-28')
    const s = makeSession({ type: 'shortBreak', completedAt: new Date(2026, 4, 28, 10).toISOString() })
    const r = calcConsistency([s], today)
    expect(r.activeDays28).toBe(0)
  })
})
