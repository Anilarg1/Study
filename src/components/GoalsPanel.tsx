import { useMemo } from 'react'
import useXPStore      from '../store/useXPStore'
import useStreakStore, { calcCurrentStreak } from '../store/useStreakStore'
import { xpToLevel, levelToXp, xpProgress } from '../utils/xp'
import type { SessionEntry } from '../types'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function sessionMins(s: SessionEntry): number {
  return s.durationSecs ? Math.round(s.durationSecs / 60) : 25
}

export default function GoalsPanel() {
  const sessions      = useXPStore(s => s.sessions)
  const totalXP       = useXPStore(s => s.totalXP)
  const loginDates    = useStreakStore(s => s.loginDates)

  const loginDateSet  = useMemo(() => new Set(loginDates), [loginDates])
  const currentStreak = useMemo(() => calcCurrentStreak(loginDateSet), [loginDateSet])

  const level     = xpToLevel(totalXP)
  const nextLevel = level + 1
  const xpProg    = xpProgress(totalXP)
  const xpToNext  = levelToXp(nextLevel) - totalXP
  const xpGoalNext = levelToXp(nextLevel)
  const xpGoalPct  = Math.min(100, Math.round(xpProg * 100))

  const thisMonthMins = useMemo(() => {
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    return sessions
      .filter(s => s.type === 'work' && new Date(s.completedAt) >= start)
      .reduce((sum, s) => sum + sessionMins(s), 0)
  }, [sessions])

  const monthGoalMins = 60 * 40
  const monthGoalPct  = Math.min(100, Math.round(thisMonthMins / monthGoalMins * 100))

  const streakGoal    = Math.ceil((currentStreak + 1) / 5) * 5
  const streakGoalPct = Math.min(100, Math.round(currentStreak / streakGoal * 100))

  const now = new Date()

  return (
    <div className="sidebar-goals">
      <div className="sidebar-goals-head">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>
        </svg>
        Goals
        <span className="sidebar-goals-month">{MONTH_NAMES[now.getMonth()]} {now.getFullYear()}</span>
      </div>

      <div className="s-goals-list">
        {/* Monthly hours */}
        <div>
          <div className="s-goal-wrap">
            <div className="s-goal-badge" style={{
              background: `linear-gradient(160deg, color-mix(in oklab, var(--focus) 24%, var(--surface-3)), var(--surface-3))`,
              border: `1px solid color-mix(in oklab, var(--focus) 26%, var(--hairline-2))`,
              color: 'var(--focus)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
              </svg>
            </div>
            <div className="s-goal-body">
              <div className="gtitle">Study {Math.round(monthGoalMins / 60)}h this month</div>
              <div className="gsub">{monthGoalPct}% complete</div>
            </div>
            <div className="s-goal-val">
              <b>{Math.floor(thisMonthMins / 60)}h {String(thisMonthMins % 60).padStart(2,'0')}m</b>
            </div>
          </div>
          <div className="s-progress" style={{ marginTop: 8 }}>
            <div className="s-progress-fill" style={{
              width: `${monthGoalPct}%`,
              background: `linear-gradient(90deg, color-mix(in oklab, var(--focus) 50%, transparent), var(--focus))`,
              boxShadow: `0 0 8px color-mix(in oklab, var(--focus) 30%, transparent)`,
            }} />
          </div>
        </div>

        {/* Streak goal */}
        <div>
          <div className="s-goal-wrap">
            <div className="s-goal-badge" style={{
              background: `linear-gradient(160deg, color-mix(in oklab, var(--streak) 24%, var(--surface-3)), var(--surface-3))`,
              border: `1px solid color-mix(in oklab, var(--streak) 26%, var(--hairline-2))`,
              color: 'var(--streak)',
            }}>
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
            <div className="s-progress-fill" style={{
              width: `${streakGoalPct}%`,
              background: `linear-gradient(90deg, color-mix(in oklab, var(--streak) 50%, transparent), var(--streak))`,
              boxShadow: `0 0 8px color-mix(in oklab, var(--streak) 30%, transparent)`,
            }} />
          </div>
        </div>

        {/* XP level goal */}
        <div>
          <div className="s-goal-wrap">
            <div className="s-goal-badge" style={{
              background: `linear-gradient(160deg, color-mix(in oklab, var(--xp) 24%, var(--surface-3)), var(--surface-3))`,
              border: `1px solid color-mix(in oklab, var(--xp) 26%, var(--hairline-2))`,
              color: 'var(--xp)',
            }}>
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
            <div className="s-progress-fill" style={{
              width: `${xpGoalPct}%`,
              background: `linear-gradient(90deg, color-mix(in oklab, var(--xp) 50%, transparent), var(--xp))`,
              boxShadow: `0 0 8px color-mix(in oklab, var(--xp) 30%, transparent)`,
            }} />
          </div>
        </div>
      </div>
    </div>
  )
}
