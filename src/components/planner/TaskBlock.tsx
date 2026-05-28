import { formatTime12h } from '../../lib/planner'
import type { Task } from '../../types'

interface Props {
  task: Task
  color: string | null     // subject colour, or null -> accent
  top: number              // px offset from grid top
  height: number           // px block height
  onClick: () => void
}

export function TaskBlock({ task, color, top, height, onClick }: Props) {
  const accent = color ?? 'var(--accent, #6c5ce7)'
  return (
    <button
      className={`task-block${task.completed_at ? ' done' : ''}`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        borderLeftColor: accent,
        background: `color-mix(in srgb, ${accent} 12%, transparent)`,
      }}
      onClick={onClick}
    >
      <span className="task-block-title">{task.title}</span>
      {task.due_time && <span className="task-block-time">{formatTime12h(task.due_time)}</span>}
    </button>
  )
}
