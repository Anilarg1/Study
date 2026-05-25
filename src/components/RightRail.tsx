import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import useXPStore      from '../store/useXPStore'
import { dateOf, fmtMins as fmtDuration, sessionMins, toLocalDateStr } from '../utils/date'
import useSubjectStore from '../store/useSubjectStore'
import useTagStore     from '../store/useTagStore'
import type { SessionEntry } from '../types'

// ── helpers ───────────────────────────────────────────────────────────────

function todayStr(): string { return toLocalDateStr() }

// ── today stats ───────────────────────────────────────────────────────────

function TodayCard({ sessions }: { sessions: SessionEntry[] }) {
  const today    = todayStr()
  const todaySes = sessions.filter(s => s.type === 'work' && dateOf(s.completedAt) === today)
  const totalMin = todaySes.reduce((sum, s) => sum + sessionMins(s), 0)

  const hourCounts = Array(24).fill(0) as number[]
  todaySes.forEach(s => {
    const h = new Date(s.completedAt).getHours()
    hourCounts[h] = (hourCounts[h] ?? 0) + 1
  })
  const maxH    = Math.max(1, ...hourCounts)
  const curHour = new Date().getHours()

  function hClass(i: number): string {
    const count = hourCounts[i] ?? 0
    if (i === curHour && count > 0) return 'h-cell now'
    const ratio = count / maxH
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

  const subjectMap = useMemo(
    () => new Map(subjects.map(s => [s.id, s])),
    [subjects],
  )
  const tagMap = useMemo(
    () => new Map(tags.map(t => [t.id, t])),
    [tags],
  )

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
        const subj = subjectMap.get(entry.subjectId ?? '')
        const tag  = tagMap.get(entry.tagId ?? '')
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
              {fmtDuration(sessionMins(entry))}
            </span>
          </div>
        )
      })}
    </>
  )
}

// ── main component ────────────────────────────────────────────────────────

export default function RightRail() {
  const location  = useLocation()
  const isStats   = location.pathname === '/stats'
  const sessions  = useXPStore(s => s.sessions)

  // ── stats rail ────────────────────────────────────────────────────────────
  if (isStats) {
    return (
      <aside className="v2-rail">
        <TodayCard sessions={sessions} />
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
