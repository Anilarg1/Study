import { useState, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import useXPStore      from '../store/useXPStore'
import useStreakStore, { toLocalDateStr, calcCurrentStreak } from '../store/useStreakStore'
import useSubjectStore from '../store/useSubjectStore'
import useTagStore     from '../store/useTagStore'
import type { SessionEntry } from '../types'

// ── helpers ───────────────────────────────────────────────────────────────


function todayStr(): string { return toLocalDateStr() }

function dateOf(iso: string): string { return toLocalDateStr(new Date(iso)) }

function fmtDuration(totalMins: number): string {
  if (totalMins === 0) return '0m'
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function relativeTime(iso: string): string {
  const d    = new Date(iso)
  const now  = Date.now()
  const diff = Math.floor((now - d.getTime()) / 1000)
  if (diff < 60)   return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  const hm = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (dateOf(iso) === todayStr()) return `Today · ${hm}`
  const yesterday = toLocalDateStr(new Date(now - 86_400_000))
  if (dateOf(iso) === yesterday) return `Yesterday · ${hm}`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` · ${hm}`
}

// ── today stats ───────────────────────────────────────────────────────────

function TodayCard({ sessions }: { sessions: SessionEntry[] }) {
  const today    = todayStr()
  const todaySes = sessions.filter(s => s.type === 'work' && dateOf(s.completedAt) === today)
  const totalMin = todaySes.reduce((sum, s) =>
    sum + (s.durationSecs ? Math.round(s.durationSecs / 60) : 25), 0
  )

  const hourCounts = Array(24).fill(0) as number[]
  todaySes.forEach(s => {
    const h = new Date(s.completedAt).getHours()
    hourCounts[h]++
  })
  const maxH    = Math.max(1, ...hourCounts)
  const curHour = new Date().getHours()

  function hClass(i: number): string {
    if (i === curHour && hourCounts[i] > 0) return 'h-cell now'
    const ratio = hourCounts[i] / maxH
    if (ratio === 0) return 'h-cell'
    if (ratio < 0.4) return 'h-cell s1'
    if (ratio < 0.8) return 'h-cell s2'
    return 'h-cell s3'
  }

  const todayDate = new Date()
  const dateLabel = todayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()

  return (
    <div className="v2-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 500 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }}>
            <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
          </svg>
          Focused time
        </span>
        <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10.5, color: 'var(--text-mute)' }}>
          {dateLabel}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 12 }}>
        <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 24, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.02em' }}>
          {totalMin === 0 ? '—' : fmtDuration(totalMin)}
        </span>
        {todaySes.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--short)', fontFamily: 'Geist Mono, monospace', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor"><path d="M6 2 2 8h8z"/></svg>
            {todaySes.length} session{todaySes.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="today-bar">
        {hourCounts.map((_, i) => (
          <div key={i} className={hClass(i)} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Geist Mono, monospace', fontSize: 9.5, color: 'var(--text-faint)' }}>
        <span>6 AM</span><span>NOON</span><span>6 PM</span><span>12</span>
      </div>
    </div>
  )
}

// ── recent sessions ───────────────────────────────────────────────────────

function RecentSessions({ sessions }: { sessions: SessionEntry[] }) {
  const subjects = useSubjectStore(s => s.subjects)
  const tags = useTagStore(s => s.tags)

  const recent = useMemo(() =>
    [...sessions].filter(s => s.type === 'work').reverse().slice(0, 8),
    [sessions]
  )

  if (recent.length === 0) {
    return (
      <div style={{ padding: '12px 8px', fontSize: 12, color: 'var(--text-faint)', textAlign: 'center' }}>
        No sessions yet — start your first timer!
      </div>
    )
  }

  return (
    <>
      {recent.map(entry => {
        const subj = subjects.find(s => s.id === entry.subjectId)
        const tag  = tags.find(t => t.id === entry.tagId)
        return (
          <div key={entry.id} className="session-row">
            <span className="session-dot" style={{ background: subj?.color ?? 'var(--text-faint)' }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: 'var(--text)', fontWeight: 450, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {subj ? subj.name : 'Focus'}
            </span>
            {tag && (
              <span style={{ fontSize: 9.5, color: 'var(--text-mute)', border: '1px solid var(--hairline)', borderRadius: 3, padding: '0 4px', lineHeight: '14px', flexShrink: 0 }}>
                {tag.name}
              </span>
            )}
            <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--text-faint)', flexShrink: 0 }}>
              {entry.durationSecs ? `${Math.round(entry.durationSecs / 60)}m` : '25m'}
            </span>
          </div>
        )
      })}
    </>
  )
}

// ── stats rail — Insights tab ─────────────────────────────────────────────

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function InsightsRail({ sessions }: { sessions: SessionEntry[] }) {
  const subjects      = useSubjectStore(s => s.subjects)
  const loginDates    = useStreakStore(s => s.loginDates)
  const totalXP       = useXPStore(s => s.totalXP)
  const longestStreak = useStreakStore(s => s.longestStreak)
  const loginDateSet  = useMemo(() => new Set(loginDates), [loginDates])
  const currentStreak = useMemo(() => calcCurrentStreak(loginDateSet), [loginDateSet])

  // ── 4-week trend ─────────────────────────────────────────────────────────
  const weeklyTrend = useMemo(() => {
    const workSessions = sessions.filter(s => s.type === 'work')
    return Array.from({ length: 4 }, (_, i) => {
      const weekOffset = 3 - i
      const end   = new Date(); end.setDate(end.getDate() - weekOffset * 7)
      const start = new Date(end); start.setDate(end.getDate() - 6)
      const mins  = workSessions
        .filter(s => {
          const d = new Date(s.completedAt)
          return d >= start && d <= end
        })
        .reduce((sum, s) => sum + (s.durationSecs ? Math.round(s.durationSecs / 60) : 25), 0)
      const label = `${MONTH_SHORT[start.getMonth()]} ${start.getDate()}`
      return { label, mins, isCurrent: i === 3 }
    })
  }, [sessions])

  const maxWeekMins = useMemo(() => Math.max(1, ...weeklyTrend.map(w => w.mins)), [weeklyTrend])

  // ── milestone events derived from data ───────────────────────────────────
  const milestones = useMemo(() => {
    const workSessions = [...sessions].filter(s => s.type === 'work')
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())

    const events: { icon: 'time' | 'streak' | 'subject' | 'xp'; title: string; when: string; xp: number }[] = []

    // Total time milestones
    const totalMins = workSessions.reduce((sum, s) => sum + (s.durationSecs ? Math.round(s.durationSecs / 60) : 25), 0)
    const timeMilestones = [6000, 3000, 1500, 600, 300, 60]
    for (const m of timeMilestones) {
      if (totalMins >= m) {
        const h = Math.round(m / 60)
        events.push({ icon: 'time', title: `${h}h focused total`, when: 'milestone', xp: h >= 50 ? 100 : h >= 25 ? 50 : 25 })
        break
      }
    }

    // Streak milestone
    if (longestStreak >= 10) {
      events.push({ icon: 'streak', title: `${longestStreak}-day streak`, when: 'best', xp: longestStreak >= 30 ? 200 : longestStreak >= 15 ? 100 : 50 })
    } else if (currentStreak >= 3) {
      events.push({ icon: 'streak', title: `${currentStreak}-day streak`, when: 'current', xp: 25 })
    }

    // Subject milestone
    const subjectMins = new Map<string, number>()
    for (const s of workSessions) {
      if (s.subjectId) subjectMins.set(s.subjectId, (subjectMins.get(s.subjectId) ?? 0) + (s.durationSecs ? Math.round(s.durationSecs / 60) : 25))
    }
    let topSubj: { id: string; mins: number } | null = null
    for (const [id, mins] of subjectMins) {
      if (!topSubj || mins > topSubj.mins) topSubj = { id, mins }
    }
    if (topSubj && topSubj.mins >= 60) {
      const subj = subjects.find(s => s.id === topSubj!.id)
      const h    = Math.floor(topSubj.mins / 60)
      events.push({ icon: 'subject', title: `${h}h on ${subj?.name ?? 'a subject'}`, when: 'reached', xp: h >= 20 ? 50 : 25 })
    }

    // XP milestone
    const xpMilestones = [5000, 2000, 1000, 500, 250, 100]
    for (const m of xpMilestones) {
      if (totalXP >= m) {
        events.push({ icon: 'xp', title: `${m.toLocaleString()} XP earned`, when: 'total', xp: 0 })
        break
      }
    }

    return events.slice(0, 4)
  }, [sessions, subjects, longestStreak, currentStreak, totalXP])

  return (
    <>
      {/* Weekly trend */}
      <div className="v2-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 500 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }}>
              <path d="M3 12a9 9 0 0 1 9-9M21 12a9 9 0 0 1-9 9M3 12h4M17 12h4M12 3v4M12 17v4"/>
            </svg>
            Weekly trend
          </span>
          <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10.5, color: 'var(--text-mute)' }}>4 wks</span>
        </div>

        <div className="s-week-cmp">
          {weeklyTrend.map((w, i) => (
            <div key={i} className="s-week-cmp-row">
              <span className={`lbl${w.isCurrent ? ' curr' : ''}`}>{w.label}</span>
              <div className="bar-bg">
                <div
                  className={`bar-fill${w.isCurrent ? ' curr' : ''}`}
                  style={{ width: `${Math.round((w.mins / maxWeekMins) * 100)}%` }}
                />
              </div>
              <span className={`val${w.isCurrent ? ' curr' : ''}`}>
                {w.mins >= 60
                  ? `${Math.floor(w.mins / 60)}h ${String(w.mins % 60).padStart(2, '0')}m`
                  : w.mins > 0 ? `${w.mins}m` : '—'
                }
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Milestones */}
      {milestones.length > 0 && (
        <div className="v2-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 500 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }}>
                <path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>
              </svg>
              Milestones
            </span>
          </div>

          {milestones.map((m, i) => (
            <div key={i} className="s-mile">
              <div className="badge" style={{
                background: `linear-gradient(160deg, color-mix(in oklab, var(--xp) 22%, var(--surface-3)), var(--surface-3))`,
                border: `1px solid color-mix(in oklab, var(--xp) 26%, var(--hairline-2))`,
                color: 'var(--xp)',
              }}>
                {m.icon === 'time'    && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>}
                {m.icon === 'streak'  && <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2s4 4 4 8a4 4 0 0 1-1.5 3c.5-.7.5-1.8 0-2.5-1-1.5-2.5-1-2.5-3 0 2-2 2.5-3 4.5a4 4 0 1 0 7.5 2C16.5 18 12 22 12 22s-7-3-7-9c0-7 7-11 7-11z"/></svg>}
                {m.icon === 'subject' && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m4 7 8-5 8 5v10l-8 5-8-5z"/></svg>}
                {m.icon === 'xp'      && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>}
              </div>
              <div className="meta">
                <div className="t">{m.title}</div>
                <div className="s">{m.when.toUpperCase()}</div>
              </div>
              {m.xp > 0 && <span className="xp-badge">+{m.xp} XP</span>}
            </div>
          ))}
        </div>
      )}

      {/* Back to timer */}
      <Link
        to="/"
        style={{ display: 'block', textAlign: 'center', fontSize: 11.5, color: 'var(--text-mute)', padding: '8px 0', textDecoration: 'none' }}
      >
        ← Back to timer
      </Link>
    </>
  )
}

// ── main component ────────────────────────────────────────────────────────

export default function RightRail() {
  const location            = useLocation()
  const isStats             = location.pathname === '/stats'
  const [statsTab, setStatsTab] = useState<'today' | 'insights'>('insights')
  const sessions            = useXPStore(s => s.sessions)

  // ── stats rail ────────────────────────────────────────────────────────────
  if (isStats) {
    return (
      <aside className="v2-rail">
        <div className="rail-tabs">
          <div className="rail-tabs-buttons">
            {(['today', 'insights'] as const).map(t => (
              <button
                key={t}
                className={`rail-tab${statsTab === t ? ' active' : ''}`}
                onClick={() => setStatsTab(t)}
              >
                {t === 'today' ? 'Today' : 'Insights'}
              </button>
            ))}
          </div>
        </div>

        {statsTab === 'today' && <TodayCard sessions={sessions} />}
        {statsTab === 'insights' && <InsightsRail sessions={sessions} />}
      </aside>
    )
  }

  // ── timer / default rail ──────────────────────────────────────────────────
  return (
    <aside className="v2-rail">
      <TodayCard sessions={sessions} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 4px 6px' }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 500 }}>Recent sessions</span>
        <Link
          to="/stats"
          style={{ fontSize: 11, color: 'var(--text-mute)', textDecoration: 'none' }}
        >
          View all →
        </Link>
      </div>
      <RecentSessions sessions={sessions} />
    </aside>
  )
}
