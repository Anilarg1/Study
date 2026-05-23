import { useState } from 'react'
import useXPStore      from '../store/useXPStore'
import useStreakStore, { toLocalDateStr } from '../store/useStreakStore'
import useSubjectStore from '../store/useSubjectStore'
import { xpToLevel, xpProgress, xpToNextLevel, levelToXp } from '../utils/xp'

// ── helpers ───────────────────────────────────────────────────────────────

const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function getLast7() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86_400_000)
    return { dateStr: toLocalDateStr(d), label: DAY_INITIALS[d.getDay()], isToday: i === 6 }
  })
}

function todayStr() { return toLocalDateStr() }

/** Parse ISO completedAt → local date string */
function dateOf(iso) { return toLocalDateStr(new Date(iso)) }

/** Format minutes as "Xh Ym" or "Ym" */
function fmtDuration(totalMins) {
  if (totalMins === 0) return '0m'
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** Relative time string (e.g. "2m ago", "Today · 11:30 AM") */
function relativeTime(iso) {
  const d   = new Date(iso)
  const now = Date.now()
  const diff = Math.floor((now - d) / 1000)
  if (diff < 60)   return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  const hm = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (dateOf(iso) === todayStr()) return `Today · ${hm}`
  const yesterday = toLocalDateStr(new Date(now - 86_400_000))
  if (dateOf(iso) === yesterday) return `Yesterday · ${hm}`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` · ${hm}`
}

/** Level name by level number */
const LEVEL_NAMES = ['Novice', 'Beginner', 'Student', 'Scholar', 'Expert', 'Master', 'Sage', 'Legend']
function levelName(lv) { return LEVEL_NAMES[Math.min(lv, LEVEL_NAMES.length - 1)] }

// ── today stats ───────────────────────────────────────────────────────────

function TodayCard({ sessions }) {
  const today    = todayStr()
  const todaySes = sessions.filter(s => s.type === 'work' && dateOf(s.completedAt) === today)
  const totalMin = todaySes.length * 25   // each focus = 25 min nominal

  // 24-col bar: bucket by hour
  const hourCounts = Array(24).fill(0)
  todaySes.forEach(s => {
    const h = new Date(s.completedAt).getHours()
    hourCounts[h]++
  })
  const maxH   = Math.max(1, ...hourCounts)
  const curHour = new Date().getHours()

  function hClass(i) {
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

// ── streak card ───────────────────────────────────────────────────────────

function StreakCard() {
  const loginDates    = useStreakStore(s => s.loginDates)
  const longestStreak = useStreakStore(s => s.longestStreak)
  const currentStreak = useStreakStore(s => s.currentStreak)
  const dateSet = new Set(loginDates)
  const last7   = getLast7()

  return (
    <div className="v2-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 500 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'inline', marginRight: 6, verticalAlign: -2, color: 'var(--streak)' }}>
            <path d="M12 2s4 4 4 8a4 4 0 0 1-1.5 3c.5-.7.5-1.8 0-2.5-1-1.5-2.5-1-2.5-3 0 2-2 2.5-3 4.5a4 4 0 1 0 7.5 2C16.5 18 12 22 12 22s-7-3-7-9c0-7 7-11 7-11z"/>
          </svg>
          Streak
        </span>
        {longestStreak > 0 && currentStreak >= longestStreak && (
          <span style={{ fontSize: 10.5, fontFamily: 'Geist Mono, monospace', color: 'var(--streak)' }}>↑ Personal best</span>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 18, fontWeight: 500, color: 'var(--text)', lineHeight: 1 }}>
          {currentStreak}
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 450, marginLeft: 4, fontFamily: 'Inter, sans-serif' }}>
            {currentStreak === 1 ? 'day in a row' : 'days in a row'}
          </span>
        </div>
        {longestStreak > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-mute)', marginTop: 3 }}>
            Best: {longestStreak} day{longestStreak !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {last7.map(({ dateStr, label, isToday }) => {
          const logged = dateSet.has(dateStr)
          let bg, border, color
          if (isToday && logged) {
            bg = 'color-mix(in oklab, var(--accent) 16%, var(--surface-3))'
            border = '1px solid var(--accent)'
            color = 'var(--text)'
          } else if (logged) {
            bg = 'color-mix(in oklab, var(--streak) 14%, var(--surface-3))'
            border = '1px solid color-mix(in oklab, var(--streak) 28%, transparent)'
            color = 'var(--text-mute)'
          } else {
            bg = 'var(--surface-3)'
            border = 'none'
            color = 'var(--text-faint)'
          }
          return (
            <div key={dateStr} style={{ aspectRatio: 1, borderRadius: 4, background: bg, border, display: 'grid', placeItems: 'center', fontFamily: 'Geist Mono, monospace', fontSize: 9.5, color, transition: 'background 700ms, border-color 700ms' }}>
              {label}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── level / xp card ───────────────────────────────────────────────────────

function LevelCard() {
  const totalXP = useXPStore(s => s.totalXP)
  const level   = xpToLevel(totalXP)
  const pct     = xpProgress(totalXP)
  const toNext  = xpToNextLevel(totalXP)

  return (
    <div className="v2-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 500 }}>
          {levelName(level)}
          <span className="lv-badge mono">LV {level}</span>
        </div>
        <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--text-dim)' }}>
          <b style={{ color: 'var(--text)', fontWeight: 500 }}>{totalXP.toLocaleString()}</b>
          {' '}/ {levelToXp(level + 1).toLocaleString()} XP
        </div>
      </div>

      <div className="xp-track">
        <div className="xp-fill" style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--text-faint)' }}>
        <span>{toNext.toLocaleString()} XP to Lv {level + 1}</span>
        <span style={{ color: 'var(--xp)' }}>+25 XP per session</span>
      </div>
    </div>
  )
}

// ── recent sessions ───────────────────────────────────────────────────────

function RecentSessions({ sessions }) {
  const subjects = useSubjectStore(s => s.subjects)

  const recent = [...sessions]
    .filter(s => s.type === 'work')
    .reverse()
    .slice(0, 8)

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
        return (
          <div key={entry.id} className="session-row">
            <span
              className="session-dot"
              style={{ background: subj?.color ?? 'var(--text-faint)' }}
            />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 450, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {subj ? subj.name : 'Focus session'}
              </span>
              <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10.5, color: 'var(--text-mute)' }}>
                {relativeTime(entry.completedAt)}
              </span>
            </div>
            <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--text-dim)' }}>
              25m
            </span>
          </div>
        )
      })}
    </>
  )
}

// ── main component ────────────────────────────────────────────────────────

export default function RightRail() {
  const [tab, setTab] = useState('today')
  const sessions      = useXPStore(s => s.sessions)

  return (
    <aside className="v2-rail">

      {/* tab row */}
      <div className="rail-tabs">
        {['today', 'week', 'all'].map(t => (
          <button
            key={t}
            className={`rail-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'today' ? 'Today' : t === 'week' ? 'Week' : 'All time'}
          </button>
        ))}
      </div>

      {/* cards */}
      <TodayCard sessions={sessions} />
      <StreakCard />
      <LevelCard />

      {/* recent sessions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 4px 6px' }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 500 }}>Recent sessions</span>
        <span style={{ fontSize: 11, color: 'var(--text-mute)', cursor: 'pointer' }}>View all →</span>
      </div>

      <RecentSessions sessions={sessions} />

    </aside>
  )
}
