import { useState, useMemo } from 'react'
import useXPStore         from '../store/useXPStore'
import useSubjectStore    from '../store/useSubjectStore'
import useStreakStore, { toLocalDateStr, calcCurrentStreak } from '../store/useStreakStore'
import { xpToLevel, levelToXp, xpProgress } from '../utils/xp'
import type { SessionEntry, Subject } from '../types'

// ─── types ────────────────────────────────────────────────────────────────────

type Range = 'week' | 'month' | 'quarter' | 'year' | 'all'

// ─── helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DAY_LABELS  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

function getRangeStart(range: Range): Date {
  const now = new Date()
  switch (range) {
    case 'week':    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
    case 'month':   return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate() + 1)
    case 'quarter': return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89)
    case 'year':    return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1)
    case 'all':     return new Date(0)
  }
}

function getPrevStart(range: Range): Date {
  if (range === 'all') return new Date(0)
  const start = getRangeStart(range)
  const now   = new Date()
  const spanMs = now.getTime() - start.getTime()
  return new Date(start.getTime() - spanMs)
}

function sessionMins(s: SessionEntry): number {
  return s.durationSecs ? Math.round(s.durationSecs / 60) : 25
}

function fmtMins(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

function fmtMinsShort(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

function dateOf(iso: string): string {
  return toLocalDateStr(new Date(iso))
}

function isWeekendDate(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  // Append T00:00 so the browser parses as local midnight, not UTC midnight
  const d = new Date(`${iso}T00:00`)
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function radarPts(N: number, R: number, cx: number, cy: number, values?: number[]): string {
  return Array.from({ length: N }, (_, i) => {
    const angle = -Math.PI / 2 + (i / N) * 2 * Math.PI
    const v = values ? (values[i] ?? 0) : 1
    return `${(cx + R * v * Math.cos(angle)).toFixed(2)},${(cy + R * v * Math.sin(angle)).toFixed(2)}`
  }).join(' ')
}

function radarLabelPos(i: number, N: number, R: number, cx: number, cy: number, pad = 9) {
  const angle = -Math.PI / 2 + (i / N) * 2 * Math.PI
  return {
    x: cx + (R + pad) * Math.cos(angle),
    y: cy + (R + pad) * Math.sin(angle),
    anchor: Math.cos(angle) < -0.3 ? 'end' : Math.cos(angle) > 0.3 ? 'start' : 'middle',
  }
}

// ─── sub-components ───────────────────────────────────────────────────────────

// KPI delta badge
function Delta({ pct, label = 'vs prev' }: { pct: number; label?: string }) {
  if (pct === 0) return <span className="s-kpi-delta flat">—</span>
  const cls = pct > 0 ? 'up' : 'down'
  const arrow = (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor">
      {pct > 0
        ? <path d="M6 2 2 8h8z"/>
        : <path d="M6 10 2 4h8z"/>}
    </svg>
  )
  return (
    <span className={`s-kpi-delta ${cls}`}>
      {arrow}
      {pct > 0 ? '+' : ''}{pct}%
      <span className="vs">{label}</span>
    </span>
  )
}

// Sparkline built from real 14-day data
function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(1, ...data)
  return (
    <div className="s-spark">
      {data.map((v, i) => {
        const norm = v / max
        const cls  = norm >= 0.7 ? 'f' : norm >= 0.35 ? 'f2' : norm > 0 ? 'f3' : ''
        return (
          <div
            key={i}
            className={`b${cls ? ' ' + cls : ''}`}
            style={{ height: `${Math.max(8, Math.round(norm * 100))}%` }}
          />
        )
      })}
    </div>
  )
}

// Radar chart — dynamic N subjects
function SubjectRadar({
  subjects,
  totalMins,
}: {
  subjects: { id: string; name: string; color: string; mins: number; pct: number }[]
  totalMins: number
}) {
  const N  = subjects.length
  const R  = 32
  const cx = 50
  const cy = 50

  if (N === 0) {
    return (
      <div className="s-radar-wrap">
        <div className="s-empty" style={{ gridColumn: '1/-1' }}>No subject data yet</div>
      </div>
    )
  }

  const maxMins  = subjects[0].mins || 1
  const normVals = subjects.map(s => s.mins / maxMins)

  // Grid rings at 33%, 66%, 100%
  const rings = [0.33, 0.66, 1]

  return (
    <div className="s-radar-wrap">
      <svg className="s-radar" viewBox="0 0 100 100" aria-hidden="true">
        {/* grid rings */}
        {rings.map(scale => (
          <polygon
            key={scale}
            points={radarPts(N, R * scale, cx, cy)}
            fill="none"
            stroke="rgba(255,255,255,0.085)"
            strokeWidth="0.4"
          />
        ))}
        {/* axis lines */}
        {Array.from({ length: N }, (_, i) => {
          const angle = -Math.PI / 2 + (i / N) * 2 * Math.PI
          return (
            <line
              key={i}
              x1={cx} y1={cy}
              x2={(cx + R * Math.cos(angle)).toFixed(2)}
              y2={(cy + R * Math.sin(angle)).toFixed(2)}
              stroke="rgba(255,255,255,0.055)"
              strokeWidth="0.4"
            />
          )
        })}
        {/* data shape */}
        <polygon
          points={radarPts(N, R, cx, cy, normVals)}
          fill="color-mix(in oklab, var(--accent) 22%, transparent)"
          stroke="var(--accent)"
          strokeWidth="0.9"
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 4px var(--accent-soft))' }}
        />
        {/* dots */}
        {subjects.map((s, i) => {
          const angle = -Math.PI / 2 + (i / N) * 2 * Math.PI
          const v = normVals[i]
          const px = (cx + R * v * Math.cos(angle)).toFixed(2)
          const py = (cy + R * v * Math.sin(angle)).toFixed(2)
          return (
            <circle key={s.id} cx={px} cy={py} r="2.4" fill={s.color} />
          )
        })}
        {/* labels */}
        {subjects.map((s, i) => {
          const pos = radarLabelPos(i, N, R, cx, cy, 10)
          return (
            <text
              key={s.id}
              x={pos.x.toFixed(1)}
              y={pos.y.toFixed(1)}
              textAnchor={pos.anchor}
              dominantBaseline="middle"
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: '3.4px',
                fill: 'var(--text-mute)',
                letterSpacing: '0.04em',
              }}
            >
              {s.name.slice(0, 6).toUpperCase()}
            </text>
          )
        })}
      </svg>

      <div className="s-radar-legend">
        {subjects.map(s => (
          <div key={s.id} className="s-radar-legend-row">
            <span className="dot" style={{ background: s.color }} />
            <span className="name">{s.name}</span>
            <span className="val">{s.pct}<sup>%</sup></span>
          </div>
        ))}
        {subjects.length > 0 && (
          <div className="s-radar-legend-foot">
            <span className="lead"><b>{subjects[0].name}</b> leads</span>
            <span className="cmp">{fmtMins(totalMins)} total</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── histogram buckets (module-level constant) ────────────────────────────────
const HIST_BUCKETS = [
  { label: '≤5',  max: 5        },
  { label: '10',  max: 10       },
  { label: '15',  max: 15       },
  { label: '20',  max: 20       },
  { label: '25',  max: 25       },
  { label: '30',  max: 30       },
  { label: '40',  max: 40       },
  { label: '50',  max: 50       },
  { label: '60',  max: 60       },
  { label: '90+', max: Infinity },
]

// ─── main component ───────────────────────────────────────────────────────────

export default function StatsPage() {
  const sessions      = useXPStore(s => s.sessions)
  const totalXP       = useXPStore(s => s.totalXP)
  const subjects      = useSubjectStore(s => s.subjects)
  const loginDates    = useStreakStore(s => s.loginDates)
  const longestStreak = useStreakStore(s => s.longestStreak)

  const [range, setRange]               = useState<Range>('month')
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null)

  // ── date range boundaries ──────────────────────────────────────────────────
  const rangeStart = useMemo(() => getRangeStart(range), [range])
  const prevStart  = useMemo(() => getPrevStart(range), [range])

  // ── filtered sessions ──────────────────────────────────────────────────────
  const workSessions = useMemo(() =>
    sessions.filter(s =>
      s.type === 'work' &&
      new Date(s.completedAt) >= rangeStart &&
      (subjectFilter === null || s.subjectId === subjectFilter)
    ),
    [sessions, rangeStart, subjectFilter]
  )

  const prevWorkSessions = useMemo(() =>
    sessions.filter(s =>
      s.type === 'work' &&
      new Date(s.completedAt) >= prevStart &&
      new Date(s.completedAt) < rangeStart &&
      (subjectFilter === null || s.subjectId === subjectFilter)
    ),
    [sessions, prevStart, rangeStart, subjectFilter]
  )

  // ── KPI totals ─────────────────────────────────────────────────────────────
  const totalMins = useMemo(() =>
    workSessions.reduce((sum, s) => sum + sessionMins(s), 0),
    [workSessions]
  )
  const prevTotalMins = useMemo(() =>
    prevWorkSessions.reduce((sum, s) => sum + sessionMins(s), 0),
    [prevWorkSessions]
  )
  const timePct    = prevTotalMins > 0 ? Math.round((totalMins - prevTotalMins) / prevTotalMins * 100) : 0
  const sessionPct = prevWorkSessions.length > 0
    ? Math.round((workSessions.length - prevWorkSessions.length) / prevWorkSessions.length * 100)
    : 0

  // ── sparklines (14-day rolling) ────────────────────────────────────────────
  const sparkTime = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i))
      const ds = toLocalDateStr(d)
      return sessions
        .filter(s => s.type === 'work' && dateOf(s.completedAt) === ds)
        .reduce((sum, s) => sum + sessionMins(s), 0)
    })
  }, [sessions])

  const sparkSessions = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i))
      const ds = toLocalDateStr(d)
      return sessions.filter(s => s.type === 'work' && dateOf(s.completedAt) === ds).length
    })
  }, [sessions])

  // ── chart bars (daily for week/month/quarter; weekly for year/all) ─────────
  type ChartBar = {
    label: string     // x-axis date label
    mins:  number
    isWeekend: boolean
    isHighlight: boolean  // today (daily) or current week (weekly)
    isWeekly: boolean
  }

  const chartBars = useMemo<ChartBar[]>(() => {
    const useWeekly = range === 'year' || range === 'all'

    if (!useWeekly) {
      const numDays = range === 'week' ? 7 : range === 'month' ? 30 : 90
      return Array.from({ length: numDays }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (numDays - 1 - i))
        const ds = toLocalDateStr(d)
        const mins = workSessions
          .filter(s => dateOf(s.completedAt) === ds)
          .reduce((sum, s) => sum + sessionMins(s), 0)
        return {
          label:       `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`,
          mins,
          isWeekend:   isWeekendDate(d),
          isHighlight: i === numDays - 1,
          isWeekly:    false,
        }
      })
    }

    // Weekly aggregation: last 52 weeks (year) or since earliest session (all)
    const WEEKS = range === 'year' ? 52 : (() => {
      if (workSessions.length === 0) return 52
      const earliest = workSessions.reduce(
        (min, s) => Math.min(min, new Date(s.completedAt).getTime()),
        Date.now()
      )
      const msAgo = Date.now() - earliest
      return Math.min(260, Math.ceil(msAgo / (7 * 86_400_000)) + 1)
    })()

    // Find the Monday of the current week
    const today = new Date()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    weekStart.setHours(0, 0, 0, 0)

    return Array.from({ length: WEEKS }, (_, i) => {
      const wStart = new Date(weekStart)
      wStart.setDate(weekStart.getDate() - (WEEKS - 1 - i) * 7)
      const wEnd = new Date(wStart)
      wEnd.setDate(wStart.getDate() + 7)

      const mins = workSessions
        .filter(s => {
          const t = new Date(s.completedAt)
          return t >= wStart && t < wEnd
        })
        .reduce((sum, s) => sum + sessionMins(s), 0)

      return {
        label:       `${MONTH_NAMES[wStart.getMonth()]} ${wStart.getDate()}`,
        mins,
        isWeekend:   false,
        isHighlight: i === WEEKS - 1,
        isWeekly:    true,
      }
    })
  }, [workSessions, range])

  const maxBarMins = useMemo(() => Math.max(60, ...chartBars.map(d => d.mins)), [chartBars])
  const avgBarMins = useMemo(() => {
    const active = chartBars.filter(d => d.mins > 0)
    return active.length > 0
      ? Math.round(active.reduce((s, d) => s + d.mins, 0) / active.length)
      : 0
  }, [chartBars])
  const yMax = useMemo(() => Math.max(1, Math.ceil(maxBarMins / 60)), [maxBarMins])

  // ── year heatmap (52 weeks) ────────────────────────────────────────────────
  const { heatWeeks, heatMonthLabels, activeDays, longestHeatStreak } = useMemo(() => {
    const minsPerDay = new Map<string, number>()
    for (const s of sessions) {
      if (s.type !== 'work') continue
      // Respect subject filter
      if (subjectFilter !== null && s.subjectId !== subjectFilter) continue
      const ds = dateOf(s.completedAt)
      minsPerDay.set(ds, (minsPerDay.get(ds) ?? 0) + sessionMins(s))
    }

    const today = new Date()
    const WEEKS = 52
    // Align start to Sunday
    const start = new Date(today)
    start.setDate(today.getDate() - WEEKS * 7 + 1)
    start.setDate(start.getDate() - start.getDay())

    const weeks: { ds: string; lvl: 0 | 1 | 2 | 3 | 4; future: boolean; mins: number }[][] = []
    let activeDays = 0
    let curStreak = 0, maxStreak = 0, runStreak = 0

    for (let w = 0; w <= WEEKS; w++) {
      const week = []
      for (let dow = 0; dow < 7; dow++) {
        const d = new Date(start)
        d.setDate(start.getDate() + w * 7 + dow)
        const future = d > today
        const ds   = toLocalDateStr(d)
        const mins = future ? 0 : (minsPerDay.get(ds) ?? 0)
        let lvl: 0 | 1 | 2 | 3 | 4 = 0
        if (!future && mins > 0) {
          activeDays++
          if (mins >= 120) lvl = 4
          else if (mins >= 60)  lvl = 3
          else if (mins >= 25)  lvl = 2
          else lvl = 1
          runStreak++
          maxStreak = Math.max(maxStreak, runStreak)
        } else {
          runStreak = 0
        }
        week.push({ ds, lvl, future, mins })
      }
      weeks.push(week)
    }

    // Month labels
    const monthLabels: { label: string; width: number }[] = []
    let lastM = -1, runLen = 0
    weeks.forEach(week => {
      const m = new Date(week[0].ds).getMonth()
      if (m !== lastM) {
        if (lastM !== -1) monthLabels.push({ label: MONTH_NAMES[lastM], width: runLen })
        lastM = m; runLen = 1
      } else { runLen++ }
    })
    if (lastM !== -1) monthLabels.push({ label: MONTH_NAMES[lastM], width: runLen })

    return { heatWeeks: weeks, heatMonthLabels: monthLabels, activeDays, longestHeatStreak: maxStreak }
  }, [sessions, subjectFilter])

  // ── subject breakdown ──────────────────────────────────────────────────────
  const subjectStats = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of workSessions) {
      if (s.subjectId) map.set(s.subjectId, (map.get(s.subjectId) ?? 0) + sessionMins(s))
    }
    return [...map.entries()]
      .map(([id, mins]) => {
        const subj = subjects.find(s => s.id === id)
        return { id, name: subj?.name ?? 'Unknown', color: subj?.color ?? '#666', mins }
      })
      .sort((a, b) => b.mins - a.mins)
  }, [workSessions, subjects])

  const subjectTotalMins = useMemo(() => Math.max(1, subjectStats.reduce((s, x) => s + x.mins, 0)), [subjectStats])

  const radarData = useMemo(() =>
    subjectStats.slice(0, 5).map(s => ({
      ...s,
      pct: Math.round(s.mins / subjectTotalMins * 100),
    })),
    [subjectStats, subjectTotalMins]
  )

  // ── hour × day raw grid (minutes per slot) ────────────────────────────────
  const hourDayRaw = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    for (const s of workSessions) {
      const d    = new Date(s.completedAt)
      const dow  = (d.getDay() + 6) % 7   // 0 = Mon
      const hour = d.getHours()
      grid[dow][hour] += sessionMins(s)
    }
    return grid
  }, [workSessions])

  // ── quantised heat levels (0–4) for rendering ─────────────────────────────
  const hourDayGrid = useMemo(() => {
    const maxVal = Math.max(1, ...hourDayRaw.flat())
    return hourDayRaw.map(row => row.map(v => {
      if (v === 0) return 0
      const n = v / maxVal
      if (n >= 0.75) return 4
      if (n >= 0.5)  return 3
      if (n >= 0.25) return 2
      return 1
    }))
  }, [hourDayRaw])

  // ── peak hour + best day summary ──────────────────────────────────────────
  const hourDaySummary = useMemo(() => {
    let peakMins = 0, peakHour = -1
    for (let h = 0; h < 24; h++) {
      const t = hourDayRaw.reduce((s, row) => s + row[h], 0)
      if (t > peakMins) { peakMins = t; peakHour = h }
    }

    const dayTotals = hourDayRaw.map((row, i) => ({
      day:   DAY_LABELS[i],
      total: row.reduce((a, b) => a + b, 0),
    }))
    const bestDay = [...dayTotals].sort((a, b) => b.total - a.total)[0]

    // Fix B4: hour 23 → "23:00 – 0:00", not "23:00 – 24:00"
    const nextHour = peakHour >= 0 ? (peakHour + 1) % 24 : -1
    return {
      peakHour: peakHour >= 0 ? `${peakHour}:00 – ${nextHour}:00` : '—',
      bestDay:  bestDay?.total > 0 ? bestDay.day : '—',
    }
  }, [hourDayRaw])

  // ── session length histogram ───────────────────────────────────────────────
  const histData = useMemo(() => {
    const counts = HIST_BUCKETS.map((b, i) => {
      const prev = i > 0 ? HIST_BUCKETS[i - 1].max : 0
      return {
        label: b.label,
        count: workSessions.filter(s => {
          const m = sessionMins(s)
          return m > prev && (b.max === Infinity ? true : m <= b.max)
        }).length
      }
    })
    const maxCount = Math.max(1, ...counts.map(c => c.count))
    const peakIdx  = counts.reduce((best, c, i) => c.count > counts[best].count ? i : best, 0)
    return counts.map((c, i) => ({ ...c, height: Math.max(2, (c.count / maxCount) * 100), isPeak: i === peakIdx }))
  }, [workSessions])

  const histStats = useMemo(() => {
    if (workSessions.length === 0) return { median: 0, mean: 0, longest: 0, completed: 0 }
    const sorted = [...workSessions].map(sessionMins).sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const mean   = sorted.reduce((s, v) => s + v, 0) / sorted.length
    const longest = sorted[sorted.length - 1]
    const completed = workSessions.filter(s => s.durationSecs !== null && s.durationSecs > 0).length
    return { median, mean: Math.round(mean * 10) / 10, longest, completed }
  }, [workSessions])

  // ── records ────────────────────────────────────────────────────────────────
  const records = useMemo(() => {
    // Build mins-per-day over ALL sessions (not just filtered)
    const allWork = sessions.filter(s => s.type === 'work')
    const minsPerDay = new Map<string, number>()
    for (const s of allWork) {
      const ds = dateOf(s.completedAt)
      minsPerDay.set(ds, (minsPerDay.get(ds) ?? 0) + sessionMins(s))
    }

    // Best day
    let bestDayMins = 0, bestDayStr = ''
    for (const [ds, mins] of minsPerDay) {
      if (mins > bestDayMins) { bestDayMins = mins; bestDayStr = ds }
    }

    // Best week (rolling 7-day windows)
    const sortedDates = [...minsPerDay.keys()].sort()
    let bestWeekMins = 0, bestWeekStart = ''
    for (let i = 0; i < sortedDates.length; i++) {
      const windowStart = new Date(sortedDates[i])
      const windowEnd   = new Date(windowStart)
      windowEnd.setDate(windowStart.getDate() + 7)
      let weekMins = 0
      for (const [ds, mins] of minsPerDay) {
        const d = new Date(ds)
        if (d >= windowStart && d < windowEnd) weekMins += mins
      }
      if (weekMins > bestWeekMins) { bestWeekMins = weekMins; bestWeekStart = sortedDates[i] }
    }

    return { bestDayMins, bestDayStr, bestWeekMins, bestWeekStart }
  }, [sessions])

  // ── streak ─────────────────────────────────────────────────────────────────
  const loginDateSet  = useMemo(() => new Set(loginDates), [loginDates])
  const currentStreak = useMemo(() => calcCurrentStreak(loginDateSet), [loginDateSet])

  // ── level / XP goal ───────────────────────────────────────────────────────
  const level       = xpToLevel(totalXP)
  const nextLevel   = level + 1
  const xpProg      = xpProgress(totalXP)
  const xpToNext    = levelToXp(nextLevel) - totalXP

  // ── goals ──────────────────────────────────────────────────────────────────
  // Monthly focus goal (adjust based on recent avg)
  const thisMonthMins = useMemo(() => {
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    return sessions
      .filter(s => s.type === 'work' && new Date(s.completedAt) >= start)
      .reduce((sum, s) => sum + sessionMins(s), 0)
  }, [sessions])
  const monthGoalMins  = 60 * 40  // 40 hours goal
  const monthGoalPct   = Math.min(100, Math.round(thisMonthMins / monthGoalMins * 100))

  // Streak goal (next 5-day milestone)
  const streakGoal    = Math.ceil((currentStreak + 1) / 5) * 5
  const streakGoalPct = Math.min(100, Math.round(currentStreak / streakGoal * 100))

  // XP level goal
  const xpGoalCurrent = levelToXp(level)
  const xpGoalNext    = levelToXp(nextLevel)
  const xpGoalPct     = Math.min(100, Math.round(xpProg * 100))

  // ── range label ────────────────────────────────────────────────────────────
  const rangeLabel = useMemo(() => {
    const now = new Date()
    const start = getRangeStart(range)
    const fmt = (d: Date) => `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`
    if (range === 'all') return 'All time'
    return `${fmt(start)} – ${fmt(now)}, ${now.getFullYear()}`
  }, [range])

  // ── last session ───────────────────────────────────────────────────────────
  const lastSession = useMemo(() => {
    const workSorted = [...sessions].filter(s => s.type === 'work')
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    const last = workSorted[0]
    if (!last) return null
    const subj = subjects.find(s => s.id === last.subjectId)
    const diffMs = Date.now() - new Date(last.completedAt).getTime()
    const diffMin = Math.round(diffMs / 60000)
    const ago = diffMin < 60
      ? `${diffMin} min ago`
      : diffMin < 1440
        ? `${Math.round(diffMin / 60)} hr ago`
        : `${Math.round(diffMin / 1440)} days ago`
    return { ago, subject: subj?.name ?? null }
  }, [sessions, subjects])

  // ── active subject filter display ─────────────────────────────────────────
  const activeSubject = subjects.find(s => s.id === subjectFilter)

  // ─── render ───────────────────────────────────────────────────────────────

  const rangeLabelMap: Record<Range, string> = {
    week:    'Week',
    month:   'Month',
    quarter: '90 days',
    year:    'Year',
    all:     'All time',
  }

  return (
    <div className="stats-page">

      {/* ── FILTER BAR ── */}
      <div className="s-filter-bar">
        <div className="s-seg">
          {(['week', 'month', 'quarter', 'year', 'all'] as Range[]).map(r => (
            <button
              key={r}
              className={range === r ? 'active' : ''}
              onClick={() => setRange(r)}
            >
              {rangeLabelMap[r]}
            </button>
          ))}
        </div>

        <span className="s-pill">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>
          </svg>
          {rangeLabel}
        </span>

        <span
          className={`s-pill${subjectFilter ? '' : ' dashed'}`}
          onClick={() => setSubjectFilter(null)}
          style={{ cursor: 'pointer' }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 6h18M6 12h12M10 18h4"/>
          </svg>
          {activeSubject ? activeSubject.name : 'All subjects'}
          {subjectFilter && <span style={{ color: 'var(--text-faint)', marginLeft: 2 }}>×</span>}
        </span>

        <div className="s-filter-spacer" />

        <span className="s-pill" style={{ color: 'var(--text-mute)', cursor: 'default' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
          Export
        </span>
      </div>

      {/* ── SCROLL AREA ── */}
      <div className="s-scroll">

        {/* Page head */}
        <div className="s-page-head">
          <div>
            <h1>Stats</h1>
            <div className="s-head-sub">
              {rangeLabel}
              {timePct !== 0 && (
                <> · <span className={`accent`} style={{ color: timePct > 0 ? 'var(--accent)' : '#d97766' }}>
                  {timePct > 0 ? '+' : ''}{fmtMins(Math.abs(totalMins - prevTotalMins))}
                </span> vs previous</>
              )}
            </div>
          </div>
          {lastSession && (
            <div className="s-head-right">
              Last session <b>{lastSession.ago}</b>
              {lastSession.subject && <> · <b>{lastSession.subject}</b></>}
            </div>
          )}
        </div>

        {/* ── KPI ROW ── */}
        <section className="s-kpi-row" style={{ marginBottom: 12 }}>

          {/* Subject mix radar — spans 2 cols */}
          <div className="sc s-kpi s-radar-card">
            <div className="s-kpi-label">
              <svg className="ic" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 22 9 18 21 6 21 2 9"/>
              </svg>
              Subject mix
              <span style={{ color: 'var(--text-faint)', fontFamily: "'Geist Mono',monospace", fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.02em', marginLeft: 4 }}>
                {range === 'all' ? 'all time' : `last ${rangeLabelMap[range].toLowerCase()}`}
              </span>
            </div>
            <SubjectRadar subjects={radarData} totalMins={totalMins} />
          </div>

          {/* Focused time */}
          <div className="sc s-kpi">
            <div className="s-kpi-label">
              <svg className="ic" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
              </svg>
              Focused time
            </div>
            <div className="s-kpi-value">
              {totalMins >= 60
                ? <><span>{Math.floor(totalMins / 60)}</span><sup>h</sup><span style={{ marginLeft: 6 }}>{String(totalMins % 60).padStart(2,'0')}</span><sup>m</sup></>
                : <><span>{totalMins}</span><sup>m</sup></>
              }
            </div>
            <div className="s-kpi-foot">
              <Delta pct={timePct} />
              <Sparkline data={sparkTime} />
            </div>
          </div>

          {/* Sessions count */}
          <div className="sc s-kpi">
            <div className="s-kpi-label">
              <svg className="ic" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <rect x="4" y="4" width="16" height="16" rx="3"/>
                <path d="M9 17V11M12 17V8M15 17v-4"/>
              </svg>
              Sessions
            </div>
            <div className="s-kpi-value">
              <span>{workSessions.length}</span>
            </div>
            <div className="s-kpi-foot">
              <Delta pct={sessionPct} />
              <Sparkline data={sparkSessions} />
            </div>
          </div>
        </section>

        {/* ── FOCUSED TIME BAR CHART ── */}
        <section className="sc" style={{ marginBottom: 12 }}>
          <div className="sc-head">
            <span className="sc-label">
              <svg className="ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 21h18M6 17v-6M11 17V9M16 17v-4M21 17V6"/>
              </svg>
              Focused time per day
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="s-legend">
                <span className="lg-key"><span className="lg-swatch"/> {chartBars[0]?.isWeekly ? 'Week' : 'Weekday'}</span>
                {!chartBars[0]?.isWeekly && (
                  <span className="lg-key"><span className="lg-swatch muted"/> Weekend</span>
                )}
                {avgBarMins > 0 && <span className="lg-key"><span className="lg-swatch line"/> avg</span>}
              </div>
              <span className="sc-meta">{rangeLabel.toUpperCase()}</span>
            </div>
          </div>

          {chartBars.length === 0 || totalMins === 0 ? (
            <div className="s-empty">No focus sessions in this period</div>
          ) : (
            <>
              <div className="s-chart-wrap">
                {/* Y-axis */}
                <div className="s-y-axis">
                  {Array.from({ length: yMax + 1 }, (_, i) => {
                    const pct = (1 - i / yMax) * 100
                    return (
                      <span key={i} style={{ top: `${pct}%` }}>
                        {i > 0 ? <>{i}<sup>h</sup></> : '0'}
                      </span>
                    )
                  })}
                </div>

                {/* Plot */}
                <div className="s-plot">
                  {Array.from({ length: yMax + 1 }, (_, i) => (
                    <div key={i} className="s-grid-line" style={{ top: `${(1 - i / yMax) * 100}%` }} />
                  ))}

                  {/* Avg line */}
                  {avgBarMins > 0 && (
                    <div
                      className="s-avg-line"
                      style={{ top: `${(1 - avgBarMins / (yMax * 60)) * 100}%` }}
                    >
                      <span className="lbl">avg {fmtMinsShort(avgBarMins)}</span>
                    </div>
                  )}

                  <div className="s-bars">
                    {chartBars.map((day, i) => {
                      const heightPct = (day.mins / (yMax * 60)) * 100
                      const cls = day.isHighlight ? 'today' : day.isWeekend ? 'weekend' : ''
                      return (
                        <div key={i} className="s-bar-col">
                          <span className="s-bar-tip">
                            {fmtMinsShort(day.mins)} · {day.label}
                          </span>
                          <div
                            className={`s-bar${cls ? ' ' + cls : ''}`}
                            style={{ height: `${Math.max(0, heightPct)}%` }}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* X-axis ticks */}
              <div className="s-x-axis">
                {(() => {
                  const n = chartBars.length
                  const ticks = n <= 7  ? [0, n - 1]
                    : n <= 30 ? [0, Math.floor(n / 3), Math.floor(2 * n / 3), n - 1]
                    : [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(3 * n / 4), n - 1]
                  return ticks.map(i => (
                    <span key={i}>{chartBars[i].label.toUpperCase()}</span>
                  ))
                })()}
              </div>
            </>
          )}
        </section>

        {/* ── YEAR HEATMAP ── */}
        <section className="sc" style={{ marginBottom: 12 }}>
          <div className="sc-head">
            <span className="sc-label">
              <svg className="ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>
              </svg>
              Activity
              <span style={{ color: 'var(--text-mute)', fontWeight: 400, marginLeft: 4 }}>— last 12 months</span>
            </span>
            <span className="sc-meta">
              <b>{activeDays}</b> active days
            </span>
          </div>

          {/* Month labels */}
          <div className="s-heatmap-months">
            {heatMonthLabels.map((m, i) => (
              <span key={i} style={{ width: `${m.width * 14}px` }}>{m.label}</span>
            ))}
          </div>

          <div className="s-heatmap-wrap">
            <div className="s-heatmap-days">
              <span/><span>Mon</span><span/><span>Wed</span><span/><span>Fri</span><span/>
            </div>
            <div className="s-heatmap">
              {heatWeeks.map((week, wi) => (
                <div key={wi} className="s-week-col">
                  {week.map((cell, di) => (
                    <div
                      key={di}
                      className={`s-h-cell${cell.future ? ' empty' : cell.lvl ? ` l${cell.lvl}` : ''}`}
                      title={cell.future ? '' : `${cell.ds}${cell.mins ? ` · ${fmtMinsShort(cell.mins)}` : ''}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="s-heat-foot">
            <span>
              Longest streak · last 12 months ·{' '}
              <b style={{ color: 'var(--text-dim)' }}>{longestHeatStreak > 0 ? `${longestHeatStreak} days` : '—'}</b>
            </span>
            <div className="s-heat-scale">
              <span>Less</span>
              <div className="s-h-cell" />
              <div className="s-h-cell l1" />
              <div className="s-h-cell l2" />
              <div className="s-h-cell l3" />
              <div className="s-h-cell l4" />
              <span>More</span>
            </div>
          </div>
        </section>

        {/* ── ROW: SUBJECTS + HOUR×DAY ── */}
        <section className="s-row-2-narrow">

          {/* Subjects breakdown */}
          <div className="sc">
            <div className="sc-head">
              <span className="sc-label">
                <svg className="ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <path d="M3.3 7 12 12l8.7-5M12 22V12"/>
                </svg>
                Subjects
              </span>
              <span className="sc-meta"><b>{fmtMins(totalMins)}</b> total</span>
            </div>

            {subjectStats.length === 0 ? (
              <div className="s-empty">No sessions with subjects yet</div>
            ) : (
              <>
                {/* Stacked bar */}
                <div className="s-stack-bar" title="Subject time mix">
                  {subjectStats.map(s => (
                    <div
                      key={s.id}
                      className="s-seg-piece"
                      style={{ background: s.color, flex: s.mins }}
                      title={`${s.name}: ${fmtMins(s.mins)}`}
                    />
                  ))}
                </div>

                {/* Subject rows */}
                {subjectStats.map(s => {
                  const pct = Math.round(s.mins / subjectTotalMins * 100)
                  return (
                    <div
                      key={s.id}
                      className="s-subj-row"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSubjectFilter(s.id === subjectFilter ? null : s.id)}
                    >
                      <span className="dot" style={{ background: s.color }} />
                      <span className="name">{s.name}</span>
                      <span className="time">{fmtMins(s.mins)}</span>
                      <span className="pct">{pct}%</span>
                    </div>
                  )
                })}
              </>
            )}
          </div>

          {/* Hour × Day heatmap */}
          <div className="sc">
            <div className="sc-head">
              <span className="sc-label">
                <svg className="ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>
                </svg>
                When you study
              </span>
              <span className="sc-meta">HOUR × DAY</span>
            </div>

            <div className="s-hh-grid">
              <div className="s-hh-days">
                {DAY_LABELS.map(d => <span key={d}>{d.slice(0, 3)}</span>)}
              </div>
              <div className="s-hh-rows">
                {hourDayGrid.map((row, di) => (
                  <div key={di} className="s-hh-row">
                    {row.map((lvl, hi) => (
                      <div
                        key={hi}
                        className={`s-hh-cell${lvl ? ` l${lvl}` : ''}`}
                        title={`${DAY_LABELS[di]} ${hi}:00`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="s-hh-x">
              <span>0</span><span>4</span><span>8</span><span>12</span><span>16</span><span>20</span><span>23</span>
            </div>

            <div className="s-hh-summary">
              <div>
                <span className="lbl">Peak hour</span>
                <span className="val">{hourDaySummary.peakHour}</span>
              </div>
              <div>
                <span className="lbl">Most focused</span>
                <span className="val">{hourDaySummary.bestDay}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── ROW: HISTOGRAM + GOALS ── */}
        <section className="s-row-2">

          {/* Session length distribution */}
          <div className="sc">
            <div className="sc-head">
              <span className="sc-label">
                <svg className="ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M3 21h18M6 17V13M10 17V9M14 17V11M18 17V7"/>
                </svg>
                Session length distribution
              </span>
              <span className="sc-meta">{workSessions.length} sessions</span>
            </div>

            {workSessions.length === 0 ? (
              <div className="s-empty">No sessions yet</div>
            ) : (
              <>
                <div className="s-hist">
                  {histData.map((b, i) => (
                    <div
                      key={i}
                      className={`s-hist-col${b.isPeak ? ' peak' : ''}`}
                      style={{ height: `${b.height}%` }}
                    >
                      <span className="label">{b.count}</span>
                    </div>
                  ))}
                </div>
                <div className="s-hist-x">
                  {HIST_BUCKETS.map(b => <span key={b.label}>{b.label}</span>)}
                </div>
                <div className="s-hist-foot">
                  <div><span className="lbl">Median</span><span className="val">{histStats.median} min</span></div>
                  <div><span className="lbl">Mean</span><span className="val">{histStats.mean} min</span></div>
                  <div><span className="lbl">Longest</span><span className="val">{fmtMins(histStats.longest)}</span></div>
                  <div>
                    <span className="lbl">Completed</span>
                    <span className="val">{histStats.completed} / {workSessions.length}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Goals & Records */}
          <div className="sc">
            <div className="sc-head">
              <span className="sc-label">
                <svg className="ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9"/>
                  <circle cx="12" cy="12" r="5"/>
                  <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
                </svg>
                Goals
              </span>
              <span className="sc-meta">{MONTH_NAMES[new Date().getMonth()]} {new Date().getFullYear()}</span>
            </div>

            <div className="s-goals-list">

              {/* Monthly hours goal */}
              <div>
                <div className="s-goal-wrap">
                  <div
                    className="s-goal-badge"
                    style={{
                      background: `linear-gradient(160deg, color-mix(in oklab, var(--focus) 24%, var(--surface-3)), var(--surface-3))`,
                      border: `1px solid color-mix(in oklab, var(--focus) 26%, var(--hairline-2))`,
                      color: 'var(--focus)',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
                    </svg>
                  </div>
                  <div className="s-goal-body">
                    <div className="gtitle">Study {Math.round(monthGoalMins / 60)} hours this month</div>
                    <div className="gsub">{monthGoalPct}% complete</div>
                  </div>
                  <div className="s-goal-val">
                    <b>{fmtMins(thisMonthMins)}</b> / {Math.round(monthGoalMins / 60)}h
                  </div>
                </div>
                <div className="s-progress" style={{ marginTop: 8 }}>
                  <div
                    className="s-progress-fill"
                    style={{
                      width: `${monthGoalPct}%`,
                      background: `linear-gradient(90deg, color-mix(in oklab, var(--focus) 50%, transparent), var(--focus))`,
                      boxShadow: `0 0 8px color-mix(in oklab, var(--focus) 30%, transparent)`,
                    }}
                  />
                </div>
              </div>

              {/* Streak goal */}
              <div>
                <div className="s-goal-wrap">
                  <div
                    className="s-goal-badge"
                    style={{
                      background: `linear-gradient(160deg, color-mix(in oklab, var(--streak) 24%, var(--surface-3)), var(--surface-3))`,
                      border: `1px solid color-mix(in oklab, var(--streak) 26%, var(--hairline-2))`,
                      color: 'var(--streak)',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2s4 4 4 8a4 4 0 0 1-1.5 3c.5-.7.5-1.8 0-2.5-1-1.5-2.5-1-2.5-3 0 2-2 2.5-3 4.5a4 4 0 1 0 7.5 2C16.5 18 12 22 12 22s-7-3-7-9c0-7 7-11 7-11z"/>
                    </svg>
                  </div>
                  <div className="s-goal-body">
                    <div className="gtitle">{streakGoal}-day streak</div>
                    <div className="gsub">{streakGoal - currentStreak} more {streakGoal - currentStreak === 1 ? 'day' : 'days'} to go</div>
                  </div>
                  <div className="s-goal-val"><b>{currentStreak}</b> / {streakGoal}</div>
                </div>
                <div className="s-progress" style={{ marginTop: 8 }}>
                  <div
                    className="s-progress-fill"
                    style={{
                      width: `${streakGoalPct}%`,
                      background: `linear-gradient(90deg, color-mix(in oklab, var(--streak) 50%, transparent), var(--streak))`,
                      boxShadow: `0 0 8px color-mix(in oklab, var(--streak) 30%, transparent)`,
                    }}
                  />
                </div>
              </div>

              {/* XP level goal */}
              <div>
                <div className="s-goal-wrap">
                  <div
                    className="s-goal-badge"
                    style={{
                      background: `linear-gradient(160deg, color-mix(in oklab, var(--xp) 24%, var(--surface-3)), var(--surface-3))`,
                      border: `1px solid color-mix(in oklab, var(--xp) 26%, var(--hairline-2))`,
                      color: 'var(--xp)',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>
                    </svg>
                  </div>
                  <div className="s-goal-body">
                    <div className="gtitle">Reach Level {nextLevel}</div>
                    <div className="gsub">{xpToNext} XP to go</div>
                  </div>
                  <div className="s-goal-val"><b>{totalXP}</b> / {xpGoalNext} XP</div>
                </div>
                <div className="s-progress" style={{ marginTop: 8 }}>
                  <div
                    className="s-progress-fill"
                    style={{
                      width: `${xpGoalPct}%`,
                      background: `linear-gradient(90deg, color-mix(in oklab, var(--xp) 50%, transparent), var(--xp))`,
                      boxShadow: `0 0 8px color-mix(in oklab, var(--xp) 30%, transparent)`,
                    }}
                  />
                </div>
              </div>

            </div>

            {/* Records strip */}
            <div className="s-records">
              <div>
                <div className="lbl">Best day</div>
                <div className="val">
                  {records.bestDayMins >= 60
                    ? <>{Math.floor(records.bestDayMins / 60)}<sup>h</sup> {records.bestDayMins % 60}<sup>m</sup></>
                    : <>{records.bestDayMins}<sup>m</sup></>
                  }
                </div>
                <div className="when">{records.bestDayStr ? fmtDate(records.bestDayStr) : '—'}</div>
              </div>
              <div>
                <div className="lbl">Best week</div>
                <div className="val">
                  {records.bestWeekMins >= 60
                    ? <>{Math.floor(records.bestWeekMins / 60)}<sup>h</sup> {records.bestWeekMins % 60}<sup>m</sup></>
                    : <>{records.bestWeekMins}<sup>m</sup></>
                  }
                </div>
                <div className="when">{records.bestWeekStart ? fmtDate(records.bestWeekStart) : '—'}</div>
              </div>
              <div>
                <div className="lbl">Longest streak</div>
                <div className="val">{longestStreak > 0 ? <>{longestStreak}<sup>d</sup></> : '—'}</div>
                <div className="when">{longestStreak > 0 ? 'all time' : ''}</div>
              </div>
            </div>
          </div>
        </section>

      </div>{/* /s-scroll */}
    </div>
  )
}
