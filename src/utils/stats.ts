import type { SessionEntry } from '../types'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Find the best consecutive 7-day window in a Map of date-string → minutes.
 * O(d log d) two-pointer sliding window — replaces the previous O(d²) approach.
 */
export function bestWeek(
  minsPerDay: Map<string, number>,
): { bestWeekMins: number; bestWeekStart: string } {
  if (minsPerDay.size === 0) return { bestWeekMins: 0, bestWeekStart: '' }

  const entries = [...minsPerDay.entries()]
    .map(([ds, mins]) => ({ ds, mins, ts: new Date(`${ds}T00:00`).getTime() }))
    .sort((a, b) => a.ts - b.ts)

  let bestWeekMins = 0
  let bestWeekStart = ''
  let windowMins = 0
  let left = 0

  for (let right = 0; right < entries.length; right++) {
    const rightEntry = entries[right]!
    windowMins += rightEntry.mins

    // Shrink: drop days that start a window more than 7 days before rightEntry
    while (rightEntry.ts - entries[left]!.ts >= WEEK_MS) {
      windowMins -= entries[left]!.mins
      left++
    }

    if (windowMins > bestWeekMins) {
      bestWeekMins = windowMins
      bestWeekStart = entries[left]!.ds
    }
  }

  return { bestWeekMins, bestWeekStart }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DateRange { from: Date; to: Date }

export interface KPIResult {
  totalMins:        number
  sessionCount:     number
  avgSessionMins:   number
  longestSessionMins: number
  prevTotalMins:    number
  prevSessionCount: number
}

export interface HeatmapCell {
  date: string   // 'YYYY-MM-DD'
  mins: number
}

export interface PeakHourResult {
  hour:      number   // 0–23, or -1 if no data
  label:     string   // '14:00 – 15:00' or '—'
  totalMins: number
}

export interface SubjectMinutes {
  subjectId: string
  mins:      number
}

export interface HistogramBucket {
  label:   string
  count:   number
  height:  number   // 0–100 (percentage of tallest bar)
  isPeak:  boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sessionMins(s: SessionEntry): number {
  return s.durationSecs ? Math.round(s.durationSecs / 60) : 25
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Pure functions ───────────────────────────────────────────────────────────

/** Build a date-string → total-minutes map for all sessions. */
export function calcMinsPerDay(sessions: SessionEntry[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const s of sessions) {
    if (s.type !== 'work') continue
    const ds = localDateStr(new Date(s.completedAt))
    map.set(ds, (map.get(ds) ?? 0) + sessionMins(s))
  }
  return map
}

/**
 * Calculate KPI totals for the current range, plus previous-period totals
 * for delta % computation.
 *
 * `sessions`    — already filtered to the current range
 * `range`       — date bounds of the current window
 * `allSessions` — the full unfiltered list, used to derive the previous window
 */
export function calcKPIs(
  sessions: SessionEntry[],
  range: DateRange,
  allSessions: SessionEntry[],
): KPIResult {
  const work = sessions.filter(s => s.type === 'work')

  const totalMins   = work.reduce((sum, s) => sum + sessionMins(s), 0)
  const sessionCount = work.length
  const avgSessionMins = sessionCount > 0 ? Math.round(totalMins / sessionCount) : 0
  const longestSessionMins = work.reduce((max, s) => Math.max(max, sessionMins(s)), 0)

  // Previous period: same span length, ending at range.from
  const spanMs    = range.to.getTime() - range.from.getTime()
  const prevTo    = range.from
  const prevFrom  = new Date(range.from.getTime() - spanMs)

  const prev = allSessions.filter(s =>
    s.type === 'work' &&
    new Date(s.completedAt) >= prevFrom &&
    new Date(s.completedAt) < prevTo,
  )

  return {
    totalMins,
    sessionCount,
    avgSessionMins,
    longestSessionMins,
    prevTotalMins:    prev.reduce((sum, s) => sum + sessionMins(s), 0),
    prevSessionCount: prev.length,
  }
}

/**
 * Return the hour (0–23) with the highest total minutes across all sessions.
 * Returns hour -1 with label '—' and totalMins 0 when there are no sessions.
 */
export function calcPeakHour(sessions: SessionEntry[]): PeakHourResult {
  const byHour = new Array<number>(24).fill(0)
  for (const s of sessions) {
    if (s.type !== 'work') continue
    const h = new Date(s.completedAt).getHours()
    byHour[h] = (byHour[h] ?? 0) + sessionMins(s)
  }

  let peakHour = -1, peakMins = 0
  for (let h = 0; h < 24; h++) {
    const m = byHour[h] ?? 0
    if (m > peakMins) { peakMins = m; peakHour = h }
  }

  if (peakHour === -1) return { hour: -1, label: '—', totalMins: 0 }
  const nextHour = (peakHour + 1) % 24
  return { hour: peakHour, label: `${peakHour}:00 – ${nextHour}:00`, totalMins: peakMins }
}

/**
 * Total minutes per subject within the given range.
 * Sessions without a subjectId are omitted.
 */
export function calcSubjectMins(
  sessions: SessionEntry[],
  range: DateRange,
): SubjectMinutes[] {
  const map = new Map<string, number>()
  for (const s of sessions) {
    if (s.type !== 'work') continue
    if (!s.subjectId) continue
    const t = new Date(s.completedAt)
    if (t < range.from || t > range.to) continue
    map.set(s.subjectId, (map.get(s.subjectId) ?? 0) + sessionMins(s))
  }
  return [...map.entries()].map(([subjectId, mins]) => ({ subjectId, mins }))
}

/**
 * Count sessions that fall into each length bucket and compute bar heights.
 * Each bucket is { label, max } where max is the upper bound in minutes
 * (Infinity for the last bucket).
 */
export function calcSessionHistogram(
  sessions: SessionEntry[],
  buckets: readonly { label: string; max: number }[],
): HistogramBucket[] {
  const counts = buckets.map((b, i) => {
    const prev = i > 0 ? (buckets[i - 1]?.max ?? 0) : 0
    const count = sessions.filter(s => {
      if (s.type !== 'work') return false
      const m = sessionMins(s)
      return m > prev && (b.max === Infinity ? true : m <= b.max)
    }).length
    return { label: b.label, count }
  })

  const maxCount = Math.max(1, ...counts.map(c => c.count))
  const peakIdx  = counts.reduce(
    (best, c, i) => c.count > (counts[best]?.count ?? 0) ? i : best,
    0,
  )

  return counts.map((c, i) => ({
    label:   c.label,
    count:   c.count,
    height:  Math.max(2, (c.count / maxCount) * 100),
    isPeak:  i === peakIdx,
  }))
}

// ── calcConsistency ───────────────────────────────────────────────────────────

export interface ConsistencyResult {
  /** Active days in the last 28 days (0–28). */
  activeDays28: number
  /** Percentage of the last 28 days that had at least one session (0–100). */
  pct:          number
  /** Longest consecutive active-day run in the last 28 days. */
  longestRun:   number
}

/**
 * Compute study consistency metrics over the last 28 days.
 * Input: work sessions only (or all — non-work sessions are skipped).
 * `today` defaults to `new Date()` — injectable for unit tests.
 */
export function calcConsistency(
  sessions: SessionEntry[],
  today: Date = new Date(),
): ConsistencyResult {
  const todayStr = localDateStr(today)

  // Build a set of active date strings within the last 28 days
  const activeDates = new Set<string>()
  for (const s of sessions) {
    if (s.type !== 'work') continue
    const ds = localDateStr(new Date(s.completedAt))
    activeDates.add(ds)
  }

  let activeDays28 = 0
  let longestRun   = 0
  let currentRun   = 0

  for (let i = 27; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const ds = localDateStr(d)
    if (ds > todayStr) continue   // guard future dates
    if (activeDates.has(ds)) {
      activeDays28++
      currentRun++
      longestRun = Math.max(longestRun, currentRun)
    } else {
      currentRun = 0
    }
  }

  return {
    activeDays28,
    pct:        Math.round((activeDays28 / 28) * 100),
    longestRun,
  }
}
