import type { Task } from '../../types'

interface Props {
  task: Task
  color: string | null
  onClick: () => void
}

export function TaskChip({ task, color, onClick }: Props) {
  const accent = color ?? 'var(--accent, #6c5ce7)'
  return (
    <button
      className={`task-chip${task.completed_at ? ' done' : ''}`}
      style={{ background: `color-mix(in srgb, ${accent} 18%, transparent)`, borderColor: accent }}
      onClick={onClick}
      title={task.title}
    >
      {task.title}
    </button>
  )
}
