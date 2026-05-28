import { useState } from 'react'
import { usePlannerStore } from '../../store/usePlannerStore'
import useGoalsStore, { useGoalProgress } from '../../store/useGoalsStore'
import useSubjectStore from '../../store/useSubjectStore'
import { groupTasks, todayISO, formatTime12h } from '../../lib/planner'
import { TaskCreateModal } from './TaskCreateModal'
import type { Task } from '../../types'
import type { BucketedTasks } from '../../lib/planner'
import type { GoalEntry } from '../../store/useGoalsStore'
import './PlannerSidebar.css'

const BUCKET_LABELS: { key: keyof BucketedTasks; label: string }[] = [
  { key: 'overdue',  label: 'Overdue' },
  { key: 'today',    label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'later',    label: 'Later' },
]

function goalLabel(g: GoalEntry): string {
  if (g.type === 'monthly_hours') return `${g.targetValue}h study`
  if (g.type === 'streak')        return `${g.targetValue}d streak`
  if (g.type === 'xp_rank')       return `Lv ${g.targetValue}`
  return `${g.targetValue}h`
}

const GOAL_COLORS: Record<string, string> = {
  monthly_hours: 'var(--focus, #6c5ce7)',
  streak:        'var(--streak, #fd9644)',
  xp_rank:       'var(--xp, #a29bfe)',
  subject_hours: 'var(--focus, #6c5ce7)',
}

function GoalRow({ goal, color }: { goal: GoalEntry; color: string }) {
  const pct = Math.round(useGoalProgress(goal.id) * 100)
  return (
    <div className="planner-goal">
      <span className="goal-dot" style={{ background: color }} />
      <span className="goal-label">{goalLabel(goal)}</span>
      <span className="goal-pct">{pct}%</span>
      <span className="goal-bar">
        <span className="goal-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </span>
    </div>
  )
}

export function PlannerSidebar() {
  const tasks        = usePlannerStore((s) => s.tasks)
  const completeTask = usePlannerStore((s) => s.completeTask)
  const goals        = useGoalsStore((s) => s.goals)
  const subjects     = useSubjectStore((s) => s.subjects)

  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [creating,    setCreating]    = useState(false)
  const [goalsOpen,   setGoalsOpen]   = useState(true)

  const today   = todayISO()
  const buckets = groupTasks(tasks, today)

  function subjectColor(id: string | null): string | null {
    if (!id) return null
    return subjects.find((s) => s.id === id)?.color ?? null
  }

  return (
    <aside className="planner-sidebar">
      {/* Goals strip */}
      <div className="planner-goals">
        <button
          className="planner-section-head"
          onClick={() => setGoalsOpen((v) => !v)}
        >
          <span>Goals</span>
          <span className={`chevron${goalsOpen ? ' open' : ''}`}>▾</span>
        </button>
        {goalsOpen && (
          <div className="planner-goals-list">
            {goals.slice(0, 4).map((g) => (
              <GoalRow
                key={g.id}
                goal={g}
                color={GOAL_COLORS[g.type] ?? 'var(--accent, #6c5ce7)'}
              />
            ))}
            {goals.length === 0 && (
              <p className="planner-empty">No goals yet.</p>
            )}
          </div>
        )}
      </div>

      {/* Task inbox */}
      <div className="planner-tasks">
        {BUCKET_LABELS.map(({ key, label }) => {
          const list = buckets[key]
          if (list.length === 0) return null
          return (
            <div key={key} className="planner-bucket">
              <div className="planner-bucket-head">
                {label} <span className="planner-count">{list.length}</span>
              </div>
              {list.map((t) => (
                <div
                  key={t.id}
                  className={`planner-task p${t.priority}${t.completed_at ? ' done' : ''}`}
                  onClick={() => setEditingTask(t)}
                >
                  <input
                    type="checkbox"
                    checked={!!t.completed_at}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => !t.completed_at && completeTask(t.id)}
                  />
                  <span className="planner-task-title">{t.title}</span>
                  {subjectColor(t.subject_id) && (
                    <span
                      className="planner-task-dot"
                      style={{ background: subjectColor(t.subject_id)! }}
                    />
                  )}
                  {t.due_time && (
                    <span className="planner-task-time">
                      {formatTime12h(t.due_time)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <button className="planner-add" onClick={() => setCreating(true)}>
        + Add task
      </button>

      {creating && (
        <TaskCreateModal defaultDate={today} onClose={() => setCreating(false)} />
      )}
      {editingTask && (
        <TaskCreateModal task={editingTask} onClose={() => setEditingTask(null)} />
      )}
    </aside>
  )
}
