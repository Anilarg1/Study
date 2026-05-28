import { useState, useMemo, memo, useDeferredValue } from 'react'
import useXPStore         from '../store/useXPStore'
import useSubjectStore    from '../store/useSubjectStore'
import useStreakStore from '../store/useStreakStore'
import { dateOf, fmtMins, sessionMins, toLocalDateStr } from '../utils/date'
import useSubjectMasteryStore from '../store/useSubjectMasteryStore'
import RankBadge    from '../components/RankBadge'
import MasteryBadge from '../components/MasteryBadge'
import { getRankFromXP, getRankProgress, getXPToNextRank, getMasteryFromXP } from '../utils/progression'
import { bestWeek, calcPeakHour, calcSubjectMins, calcSessionHistogram } from '../utils/stats'
import { Delta, Sparkline, SubjectRadar }   from '../components/stats/KPIRow'
import { FocusTimeChart }                   from '../components/stats/FocusTimeChart'
import type { ChartBar }                    from '../components/stats/FocusTimeChart'
import { ActivityHeatmap }                  from '../components/stats/ActivityHeatmap'
import { SubjectBreakdown }                 from '../components/stats/SubjectBreakdown'
import { SessionHistogram, HIST_BUCKETS }   from '../components/stats/SessionHistogram'
import { Records }                          from '../components/stats/Records'

// ─── types ────────────────────────────────────────────────────────────────────

type Range = 'week' | 'month' | 'quarter' | 'year' | 'all'

// ─── helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
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


function isWeekendDate(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

// ─── progression card ─────────────────────────────────────────────────────────

const ProgressionCard = memo(function ProgressionCard() {
  const totalXP   = useXPStore(s => s.totalXP)
  const sessions  = useXPStore(s => s.sessions)
  const subjects  = useSubjectStore(s => s.subjects)
  const subjectXP = useSubjectMasteryStore(s => s.subjectXP)

  const rank     = getRankFromXP(totalXP)
  const pct      = Math.round(getRankProgress(totalXP) * 100)
  const toNext   = getXPToNextRank(totalXP)

  // Total qualifying study hours (work sessions with durationSecs)
  const totalHours = sessions
    .filter(s => s.type === 'work' && s.durationSecs != null)
    .reduce((sum, s) => sum + (s.durationSecs ?? 0) / 3600, 0)

  return (
    <div className="v2-card">
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 14 }}>
        Progression
      </div>

      {/* Global rank */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <RankBadge tierIndex={rank.tierIndex} size={64} subLevel={rank.subLevel} showPips={true} />
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: rank.color }}>{rank.label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
            {totalXP.toLocaleString()} XP · {totalHours.toFixed(1)}h studied
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
            {toNext > 0 ? `${toNext.toLocaleString()} XP to next rank` : 'Max rank reached'}
          </div>
        </div>
      </div>

      {/* Rank progress bar */}
      <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 2, marginBottom: 20 }}>
        <div style={{
          height: '100%',
          width:  `${pct}%`,
          background: rank.color,
          borderRadius: 2,
          transition: 'width 600ms ease',
        }} />
      </div>

      {/* Subject mastery table */}
      {subjects.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>
            Subject Mastery
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {subjects.map(s => {
              const sXP    = subjectXP[s.id] ?? 0
              const mastery = getMasteryFromXP(sXP)
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="subj-dot" style={{ background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{s.name}</span>
                  <MasteryBadge masteryIndex={mastery.index} size={16} />
                  <span style={{ fontSize: 11, color: mastery.color, fontWeight: 600, minWidth: 52, textAlign: 'right' }}>
                    {mastery.name}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
})

// ─── main component ───────────────────────────────────────────────────────────

export default function StatsPage() {
  const sessions      = useXPStore(s => s.sessions)
  const subjects      = useSubjectStore(s => s.subjects)
  const longestStreak = useStreakStore(s => s.longestStreak)

  const [range, setRange]               = useState<Range>('month')
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null)

  const deferredRange         = useDeferredValue(range)
  const deferredSubjectFilter = useDeferredValue(subjectFilter)

  // ── date range boundaries ──────────────────────────────────────────────────
  const rangeStart = useMemo(() => getRangeStart(deferredRange), [deferredRange])
  const prevStart  = useMemo(() => getPrevStart(deferredRange), [deferredRange])

  // ── filtered sessions ──────────────────────────────────────────────────────
  const workSessions = useMemo(() =>
    sessions.filter(s =>
      s.type === 'work' &&
      new Date(s.completedAt) >= rangeStart &&
      (deferredSubjectFilter === null || s.subjectId === deferredSubjectFilter)
    ),
    [sessions, rangeStart, deferredSubjectFilter]
  )

  const prevWorkSessions = useMemo(() =>
    sessions.filter(s =>
      s.type === 'work' &&
      new Date(s.completedAt) >= prevStart &&
      new Date(s.completedAt) < rangeStart &&
      (deferredSubjectFilter === null || s.subjectId === deferredSubjectFilter)
    ),
    [sessions, prevStart, rangeStart, deferredSubjectFilter]
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
  const { sparkTime, sparkSessions } = useMemo(() => {
    // Single pass over sessions — build a date → {mins, count} map
    const byDate = new Map<string, { mins: number; count: number }>()
    for (const s of sessions) {
      if (s.type !== 'work') continue
      const ds  = dateOf(s.completedAt)
      const cur = byDate.get(ds) ?? { mins: 0, count: 0 }
      byDate.set(ds, { mins: cur.mins + sessionMins(s), count: cur.count + 1 })
    }

    const time: number[]  = []
    const count: number[] = []
    for (let i = 0; i < 14; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (13 - i))
      const entry = byDate.get(toLocalDateStr(d))
      time.push(entry?.mins  ?? 0)
      count.push(entry?.count ?? 0)
    }
    return { sparkTime: time, sparkSessions: count }
  }, [sessions])

  // ── chart bars (daily for week/month/quarter; weekly for year/all) ─────────
  const chartBars = useMemo<ChartBar[]>(() => {
    const useWeekly = deferredRange === 'year' || deferredRange === 'all'

    if (!useWeekly) {
      const numDays = deferredRange === 'week' ? 7 : deferredRange === 'month' ? 30 : 90
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
    const WEEKS = deferredRange === 'year' ? 52 : (() => {
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
  }, [workSessions, deferredRange])

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
      if (deferredSubjectFilter !== null && s.subjectId !== deferredSubjectFilter) continue
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
    let maxStreak = 0, runStreak = 0

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
      const firstDay = week[0]
      if (!firstDay) return
      const m = new Date(firstDay.ds).getMonth()
      if (m !== lastM) {
        if (lastM !== -1) monthLabels.push({ label: MONTH_NAMES[lastM] ?? '', width: runLen })
        lastM = m; runLen = 1
      } else { runLen++ }
    })
    if (lastM !== -1) monthLabels.push({ label: MONTH_NAMES[lastM] ?? '', width: runLen })

    return { heatWeeks: weeks, heatMonthLabels: monthLabels, activeDays, longestHeatStreak: maxStreak }
  }, [sessions, deferredSubjectFilter])

  // ── subject breakdown ──────────────────────────────────────────────────────
  const subjectStats = useMemo(() => {
    return calcSubjectMins(workSessions, { from: rangeStart, to: new Date() })
      .map(({ subjectId, mins }) => {
        const subj = subjects.find(s => s.id === subjectId)
        return { id: subjectId, name: subj?.name ?? 'Unknown', color: subj?.color ?? '#666', mins }
      })
      .sort((a, b) => b.mins - a.mins)
  }, [workSessions, subjects, rangeStart])

  const subjectTotalMins = useMemo(() => Math.max(1, subjectStats.reduce((s, x) => s + x.mins, 0)), [subjectStats])

  const radarData = useMemo(() =>
    subjectStats.slice(0, 8).map(s => ({
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
      const row = grid[dow]
      if (row) row[hour] = (row[hour] ?? 0) + sessionMins(s)
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
    const peak = calcPeakHour(workSessions)
    // Fix B4: hour 23 → "23:00 – 0:00", not "23:00 – 24:00"
    const nextHour = peak.hour >= 0 ? (peak.hour + 1) % 24 : -1

    const dayTotals = hourDayRaw.map((row, i) => ({
      day:   DAY_LABELS[i] ?? '',
      total: row.reduce((a, b) => a + b, 0),
    }))
    const bestDay = [...dayTotals].sort((a, b) => b.total - a.total)[0] ?? null

    return {
      peakHour: peak.hour >= 0 ? `${peak.hour}:00 – ${nextHour}:00` : '—',
      bestDay:  bestDay !== null && bestDay.total > 0 ? bestDay.day : '—',
    }
  }, [hourDayRaw, workSessions])

  // ── session length histogram ───────────────────────────────────────────────
  const histData = useMemo(() => {
    const counts = calcSessionHistogram(workSessions, HIST_BUCKETS)
    const maxCount = Math.max(1, ...counts.map(c => c.count))
    const peakIdx  = counts.reduce((best, c, i) => c.count > (counts[best]?.count ?? 0) ? i : best, 0)
    return counts.map((c, i) => ({ ...c, height: Math.max(2, (c.count / maxCount) * 100), isPeak: i === peakIdx }))
  }, [workSessions])

  const histStats = useMemo(() => {
    if (workSessions.length === 0) return { median: 0, mean: 0, longest: 0, completed: 0 }
    const sorted = [...workSessions].map(sessionMins).sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0
    const mean   = sorted.reduce((s, v) => s + v, 0) / sorted.length
    const longest = sorted[sorted.length - 1] ?? 0
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

    // Best week (rolling 7-day windows) — O(d log d) sliding window
    const { bestWeekMins, bestWeekStart } = bestWeek(minsPerDay)

    return { bestDayMins, bestDayStr, bestWeekMins, bestWeekStart }
  }, [sessions])

  // ── range label ────────────────────────────────────────────────────────────
  const rangeLabel = useMemo(() => {
    const now = new Date()
    const start = getRangeStart(deferredRange)
    const fmt = (d: Date) => `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`
    if (deferredRange === 'all') return 'All time'
    return `${fmt(start)} – ${fmt(now)}, ${now.getFullYear()}`
  }, [deferredRange])

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

  // ── export ─────────────────────────────────────────────────────────────────
  function handleExport() {
    const rows = [
      ['Date', 'Subject', 'Duration (min)', 'XP'].join(','),
      ...workSessions.map(s => {
        const subj = subjects.find(x => x.id === s.subjectId)?.name ?? ''
        const mins = sessionMins(s)
        const date = dateOf(s.completedAt)
        return [date, subj, mins, s.xp].join(',')
      }),
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `study-sessions-${range}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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

        <span
          className="s-pill"
          style={{ cursor: 'pointer' }}
          onClick={handleExport}
          title={`Export ${workSessions.length} sessions as CSV`}
        >
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

        {/* ── PROGRESSION CARD ── */}
        <ProgressionCard />

        {/* ── FOCUSED TIME BAR CHART ── */}
        <FocusTimeChart
          chartBars={chartBars}
          maxBarMins={maxBarMins}
          avgBarMins={avgBarMins}
          yMax={yMax}
          totalMins={totalMins}
          rangeLabel={rangeLabel}
        />

        {/* ── YEAR HEATMAP ── */}
        <ActivityHeatmap
          heatWeeks={heatWeeks}
          heatMonthLabels={heatMonthLabels}
          activeDays={activeDays}
          longestHeatStreak={longestHeatStreak}
        />

        {/* ── ROW: SUBJECTS + HOUR×DAY ── */}
        <section className="s-row-2-narrow">

          {/* Subjects breakdown */}
          <SubjectBreakdown
            subjectStats={subjectStats}
            subjectTotalMins={subjectTotalMins}
            totalMins={totalMins}
            subjectFilter={subjectFilter}
            onFilterChange={setSubjectFilter}
          />

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

        {/* ── ROW: HISTOGRAM + RECORDS ── */}
        <section className="s-row-2">

          {/* Session length distribution */}
          <SessionHistogram
            histData={histData}
            histStats={histStats}
            sessionCount={workSessions.length}
          />

          {/* Records */}
          <Records
            records={records}
            longestStreak={longestStreak}
          />
        </section>

      </div>{/* /s-scroll */}
    </div>
  )
}
