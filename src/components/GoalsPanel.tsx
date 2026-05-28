import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import useGoalsStore, { useGoalProgress } from '../store/useGoalsStore'
import useStreakStore, { calcCurrentStreak } from '../store/useStreakStore'
import useXPStore from '../store/useXPStore'
import { levelToXp } from '../utils/xp'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Single goal row ───────────────────────────────────────────────────────────

function GoalRow({ goalId, color }: { goalId: string; color: string }) {
  const goal    = useGoalsStore(s => s.goals.find(g => g.id === goalId))
  const pct     = Math.round(useGoalProgress(goalId) * 100)
  const sessions = useXPStore(s => s.sessions)
  const totalXP  = useXPStore(s => s.totalXP)
  const loginDates = useStreakStore(s => s.loginDates)
  const currentStreak = useMemo(() => calcCurrentStreak(new Set(loginDates)), [loginDates])

  if (!goal) return null

  let label = ''
  let value = ''

  if (goal.type === 'monthly_hours') {
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0)
    const mins = sessions
      .filter(s => s.type === 'work' && new Date(s.completedAt) >= start)
      .reduce((sum, s) => sum + (s.durationSecs ? Math.round(s.durationSecs / 60) : 25), 0)
    label = `${goal.targetValue}h study`
    value = `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`
  } else if (goal.type === 'streak') {
    label = `${goal.targetValue}d streak`
    value = `${currentStreak}/${goal.targetValue}`
  } else if (goal.type === 'xp_rank') {
    const nextLevel = goal.targetValue
    const xpToNext = levelToXp(Number(nextLevel)) - totalXP
    label = `Lv ${nextLevel}`
    value = `${Math.max(0, xpToNext).toLocaleString()} XP`
  } else if (goal.type === 'subject_hours') {
    label = `${goal.targetValue}h`
    value = `${Math.round(pct)}%`
  }

  return (
    <div className="sg-row">
      <span className="sg-dot" style={{ background: color }} />
      <span className="sg-label">{label}</span>
      <div className="sg-bar">
        <div className="sg-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="sg-val">{value}</span>
    </div>
  )
}

// ── GoalsPanel ────────────────────────────────────────────────────────────────

const GOAL_COLORS: Record<string, string> = {
  monthly_hours: 'var(--focus)',
  streak:        'var(--streak)',
  xp_rank:       'var(--xp)',
  subject_hours: 'var(--focus)',
}

export default function GoalsPanel() {
  const goals = useGoalsStore(s => s.goals)
  const now   = new Date()

  if (goals.length === 0) return null

  return (
    <div className="sidebar-goals">
      <div className="sidebar-goals-head">
        Goals
        <span className="sidebar-goals-month">{MONTH_NAMES[now.getMonth()]}</span>
      </div>

      <div className="sg-list">
        {goals.slice(0, 3).map(g => (
          <GoalRow
            key={g.id}
            goalId={g.id}
            color={GOAL_COLORS[g.type] ?? 'var(--focus)'}
          />
        ))}
      </div>

      <Link to="/planner" className="goals-panel-link">Planner →</Link>
    </div>
  )
}
