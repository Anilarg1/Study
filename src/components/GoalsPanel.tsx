import { useState, useMemo } from 'react'
import useGoalsStore, { useGoalProgress } from '../store/useGoalsStore'
import type { GoalEntry } from '../store/useGoalsStore'
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

// ── GoalEditPanel ─────────────────────────────────────────────────────────────

function GoalEditPanel({
  goals,
  onSave,
  onClose,
}: {
  goals: GoalEntry[]
  onSave: (g: Omit<GoalEntry, 'id'> & { id?: string }) => Promise<void>
  onClose: () => void
}) {
  const monthlyHours = goals.find(g => g.type === 'monthly_hours')
  const streak       = goals.find(g => g.type === 'streak')

  const [hours,  setHours]  = useState(String(monthlyHours?.targetValue ?? 40))
  const [streak_,setStreak] = useState(String(streak?.targetValue ?? 5))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    if (monthlyHours) {
      await onSave({ ...monthlyHours, targetValue: Math.max(1, Number(hours)) })
    }
    if (streak) {
      await onSave({ ...streak, targetValue: Math.max(1, Number(streak_)) })
    }
    setSaving(false)
    onClose()
  }

  return (
    <div style={{
      marginTop:    8,
      padding:      '10px 12px',
      background:   'var(--surface-2)',
      borderRadius: 8,
      border:       '1px solid var(--hairline)',
      display:      'flex',
      flexDirection: 'column',
      gap:          10,
    }}>
      {monthlyHours && (
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--text-dim)' }}>
          Monthly hours target
          <input
            type="number"
            min={1}
            max={720}
            value={hours}
            onChange={e => setHours(e.target.value)}
            style={{
              width: 56, fontSize: 12, textAlign: 'right',
              background: 'var(--surface-3)', border: '1px solid var(--hairline)',
              borderRadius: 4, color: 'var(--text)', padding: '2px 6px',
            }}
          />
        </label>
      )}
      {streak && (
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--text-dim)' }}>
          Streak target (days)
          <input
            type="number"
            min={1}
            max={3650}
            value={streak_}
            onChange={e => setStreak(e.target.value)}
            style={{
              width: 56, fontSize: 12, textAlign: 'right',
              background: 'var(--surface-3)', border: '1px solid var(--hairline)',
              borderRadius: 4, color: 'var(--text)', padding: '2px 6px',
            }}
          />
        </label>
      )}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{ fontSize: 11, color: 'var(--text-mute)', background: 'none', border: '1px solid var(--hairline)', borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ fontSize: 11, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
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
  const [editing, setEditing] = useState(false)
  const upsertGoal = useGoalsStore(s => s.upsertGoal)

  if (goals.length === 0) return null

  return (
    <div className="sidebar-goals">
      <div className="sidebar-goals-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Goals
          <span className="sidebar-goals-month">{MONTH_NAMES[now.getMonth()]}</span>
        </div>
        <button
          onClick={() => setEditing(e => !e)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: editing ? 'var(--accent)' : 'var(--text-mute)',
            fontSize: 13, padding: 0, lineHeight: 1,
          }}
          title={editing ? 'Close edit' : 'Edit goals'}
        >
          ✎
        </button>
      </div>

      <div className="sg-list">
        {goals.map(g => (
          <GoalRow
            key={g.id}
            goalId={g.id}
            color={GOAL_COLORS[g.type] ?? 'var(--focus)'}
          />
        ))}
      </div>

      {editing && (
        <GoalEditPanel goals={goals} onSave={upsertGoal} onClose={() => setEditing(false)} />
      )}
    </div>
  )
}
