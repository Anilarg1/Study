import { useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import useXPStore      from '../store/useXPStore'
import useTimerStore   from '../store/useTimerStore'
import useSubjectStore from '../store/useSubjectStore'
import useTagStore     from '../store/useTagStore'
import { dateOf, fmtMins as fmtDuration, sessionMins, toLocalDateStr } from '../utils/date'
import type { SessionEntry, TimerMode } from '../types'

// ── timer widget helpers ──────────────────────────────────────────────────

export function formatMMSS(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function calcProgress(remaining: number, total: number): number {
  if (!total || !Number.isFinite(total)) return 0
  return Math.max(0, Math.min(1, 1 - remaining / total))
}

const MODE_LABELS: Record<TimerMode, string> = {
  work:       'Focus',
  shortBreak: 'Short Break',
  longBreak:  'Long Break',
}

const MODE_COLORS: Record<TimerMode, string> = {
  work:       '#f97316',
  shortBreak: '#22c55e',
  longBreak:  '#818cf8',
}

function RunningTimerWidget() {
  const running         = useTimerStore(s => s.running)
  const storedRemaining = useTimerStore(s => s.remaining)   // re-renders on each tick
  const expiresAt       = useTimerStore(s => s.expiresAt)
  const mode            = useTimerStore(s => s.mode)
  const customDurations = useTimerStore(s => s.customDurations)
  const subjectId       = useTimerStore(s => s.subjectId)
  const tagId           = useTimerStore(s => s.tagId)
  const pause           = useTimerStore(s => s.pause)
  const start           = useTimerStore(s => s.start)
  const tick            = useTimerStore(s => s.tick)

  const subjects = useSubjectStore(s => s.subjects)
  const tags     = useTagStore(s => s.tags)

  const subject = subjects.find(s => s.id === subjectId) ?? null
  const tag     = tags.find(t => t.id === tagId) ?? null

  // Own tick loop — PomodoroTimer is unmounted while this widget is visible,
  // so its interval is gone. We tick every 500 ms to keep the store up to date.
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const done = tick()
      if (done) clearInterval(id)
    }, 500)
    return () => clearInterval(id)
  }, [running, tick])

  // Compute displayed remaining directly from expiresAt for wall-clock accuracy.
  // Fall back to storedRemaining when paused (expiresAt is null when paused).
  const remaining = running && expiresAt
    ? Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000))
    : storedRemaining

  const total    = customDurations[mode]
  const progress = calcProgress(remaining, total)

  return (
    <div style={{ paddingTop: 10, paddingBottom: 10, marginBottom: 2 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>

        {/* ── Left column ── */}
        <div>
          {/* Pulse dot + mode label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: MODE_COLORS[mode],
              flexShrink: 0, display: 'inline-block',
            }} />
            <span style={{ fontSize: 9, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {MODE_LABELS[mode]}
            </span>
          </div>

          {/* Subject — only during work sessions */}
          {mode === 'work' && (
            subject ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: subject.color,
                  flexShrink: 0, display: 'inline-block',
                }} />
                <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
                  {subject.name}
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-mute)', marginBottom: 3 }}>
                Focus
              </div>
            )
          )}

          {/* Tag chip */}
          {tag && (
            <span style={{
              fontSize: 9, color: 'var(--text-mute)',
              border: '1px solid var(--hairline)', borderRadius: 3,
              padding: '0 5px', lineHeight: '15px',
              display: 'inline-block', marginBottom: 5,
            }}>
              {tag.name}
            </span>
          )}

          {/* Back link */}
          <Link
            to="/"
            style={{
              display: 'block', fontSize: 9.5,
              color: 'var(--text-faint)', textDecoration: 'none',
              marginTop: tag ? 0 : 4,
            }}
          >
            ↩ Timer
          </Link>
        </div>

        {/* ── Right column ── */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontFamily: 'Geist Mono, monospace',
            fontSize: 30, fontWeight: 800,
            color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1,
          }}>
            {formatMMSS(remaining)}
          </div>
          <button
            onClick={running ? pause : start}
            style={{
              marginTop: 6,
              fontSize: 9.5,
              color: 'var(--accent, #6c6cff)',
              border: '1px solid color-mix(in srgb, var(--accent, #6c6cff) 30%, transparent)',
              background: 'color-mix(in srgb, var(--accent, #6c6cff) 10%, transparent)',
              borderRadius: 4,
              padding: '3px 9px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {running ? '⏸ Pause' : '▶ Resume'}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: 'var(--hairline)', borderRadius: 2, marginTop: 9, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${progress * 100}%`,
          background: 'linear-gradient(90deg, #6c6cff, #a78bfa)',
          borderRadius: 2,
          transition: 'width 0.5s linear',
        }} />
      </div>

      {/* Hairline divider before next rail section */}
      <div style={{ borderBottom: '1px solid var(--hairline)', marginTop: 10 }} />
    </div>
  )
}

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
  const isTimerPage = location.pathname === '/'
  const sessions  = useXPStore(s => s.sessions)

  // Widget visibility — show when timer is in progress on any non-timer page.
  // hasStarted guards against phantom widget when duration is increased in settings
  // before the timer has ever been started (remaining < customDurations[mode] would
  // otherwise be true even though the timer was never running).
  const running         = useTimerStore(s => s.running)
  const remaining       = useTimerStore(s => s.remaining)
  const mode            = useTimerStore(s => s.mode)
  const customDurations = useTimerStore(s => s.customDurations)
  const hasStarted      = useTimerStore(s => s.hasStarted)
  const isInProgress    = running || (hasStarted && remaining < customDurations[mode])
  const showWidget      = !isTimerPage && isInProgress

  // ── stats rail ────────────────────────────────────────────────────────────
  if (isStats) {
    return (
      <aside className="v2-rail">
        {showWidget && <RunningTimerWidget />}
        <TodayCard sessions={sessions} />
      </aside>
    )
  }

  // ── timer / default rail ──────────────────────────────────────────────────
  return (
    <aside className="v2-rail">
      {showWidget && <RunningTimerWidget />}
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
