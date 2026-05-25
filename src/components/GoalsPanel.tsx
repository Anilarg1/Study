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

  const xpGoalPct = Math.min(100, Math.round(xpProg * 100))

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
        Goals
        <span className="sidebar-goals-month">{MONTH_NAMES[now.getMonth()]}</span>
      </div>

      <div className="sg-list">
        {/* Monthly hours */}
        <div className="sg-row">
          <span className="sg-dot" style={{ background: 'var(--focus)' }} />
          <span className="sg-label">40h study</span>
          <div className="sg-bar">
            <div className="sg-fill" style={{ width: `${monthGoalPct}%`, background: 'var(--focus)' }} />
          </div>
          <span className="sg-val">
            {Math.floor(thisMonthMins / 60)}h {String(thisMonthMins % 60).padStart(2, '0')}m
          </span>
        </div>

        {/* Streak */}
        <div className="sg-row">
          <span className="sg-dot" style={{ background: 'var(--streak)' }} />
          <span className="sg-label">{streakGoal}d streak</span>
          <div className="sg-bar">
            <div className="sg-fill" style={{ width: `${streakGoalPct}%`, background: 'var(--streak)' }} />
          </div>
          <span className="sg-val">{currentStreak}/{streakGoal}</span>
        </div>

        {/* XP level */}
        <div className="sg-row">
          <span className="sg-dot" style={{ background: 'var(--xp)' }} />
          <span className="sg-label">Lv {nextLevel}</span>
          <div className="sg-bar">
            <div className="sg-fill" style={{ width: `${xpGoalPct}%`, background: 'var(--xp)' }} />
          </div>
          <span className="sg-val">{xpToNext.toLocaleString()} XP</span>
        </div>
      </div>
    </div>
  )
}
