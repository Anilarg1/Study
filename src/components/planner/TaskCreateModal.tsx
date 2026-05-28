import { useState } from 'react'
import { usePlannerStore } from '../../store/usePlannerStore'
import useSubjectStore from '../../store/useSubjectStore'
import useAuthStore from '../../store/useAuthStore'
import type { Task, TaskPriority, RecurrenceRule } from '../../types'
import './TaskCreateModal.css'

interface Props {
  task?: Task | null
  defaultDate?: string
  defaultTime?: string | null
  onClose: () => void
}

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: 1, label: 'P1' },
  { value: 2, label: 'P2' },
  { value: 3, label: 'P3' },
  { value: 4, label: 'None' },
]

export function TaskCreateModal({ task, defaultDate, defaultTime, onClose }: Props) {
  const isEdit = !!task
  const user = useAuthStore((s) => s.user)
  const subjects = useSubjectStore((s) => s.subjects)
  const createTask = usePlannerStore((s) => s.createTask)
  const updateTask = usePlannerStore((s) => s.updateTask)
  const deleteTask = usePlannerStore((s) => s.deleteTask)

  const [title, setTitle] = useState(task?.title ?? '')
  const [subjectId, setSubjectId] = useState<string | ''>(task?.subject_id ?? '')
  const [dueDate, setDueDate] = useState(task?.due_date ?? defaultDate ?? '')
  const [dueTime, setDueTime] = useState(task?.due_time ?? defaultTime ?? '')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 4)
  const [isRecurring, setIsRecurring] = useState(task?.is_recurring ?? false)
  const [recurrence, setRecurrence] = useState<RecurrenceRule>(task?.recurrence ?? 'weekly')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const canSubmit = title.trim().length > 0 && dueDate.length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !user) return
    const payload = {
      user_id:      user.id,
      subject_id:   subjectId || null,
      title:        title.trim(),
      notes:        notes.trim() || null,
      due_date:     dueDate,
      due_time:     dueTime || null,
      priority,
      is_recurring: isRecurring,
      recurrence:   isRecurring ? recurrence : null,
      completed_at: task?.completed_at ?? null,
    }
    if (isEdit && task) {
      await updateTask(task.id, payload)
    } else {
      await createTask(payload)
    }
    onClose()
  }

  async function handleDelete() {
    if (!task) return
    await deleteTask(task.id)
    onClose()
  }

  return (
    <div className="task-modal-backdrop" onClick={onClose}>
      <div className="task-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="task-modal-title">{isEdit ? 'Edit task' : 'New task'}</h2>
        <form onSubmit={handleSubmit} className="task-modal-form">
          <label className="task-field">
            <span>Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Past paper — Unit 4"
              autoFocus
            />
          </label>

          <label className="task-field">
            <span>Subject</span>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">No subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          <div className="task-field-row">
            <label className="task-field">
              <span>Due date</span>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>
            <label className="task-field">
              <span>Time</span>
              <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </label>
          </div>

          <div className="task-field">
            <span>Priority</span>
            <div className="task-priority-row">
              {PRIORITIES.map((p) => (
                <button
                  type="button"
                  key={p.value}
                  className={`task-priority-btn p${p.value}${priority === p.value ? ' active' : ''}`}
                  onClick={() => setPriority(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <label className="task-checkbox">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
            />
            <span>Repeat this task</span>
          </label>
          {isRecurring && (
            <div className="task-recurrence-row">
              {(['daily', 'weekly', 'monthly'] as RecurrenceRule[]).map((r) => (
                <button
                  type="button"
                  key={r}
                  className={`task-recurrence-btn${recurrence === r ? ' active' : ''}`}
                  onClick={() => setRecurrence(r)}
                >
                  {r[0].toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          )}

          <label className="task-field">
            <span>Notes</span>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          <div className="task-modal-actions">
            <button type="button" className="task-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="task-btn-primary" disabled={!canSubmit}>
              {isEdit ? 'Save' : 'Add task'}
            </button>
          </div>

          {isEdit && !confirmingDelete && (
            <button type="button" className="task-delete-link" onClick={() => setConfirmingDelete(true)}>
              Delete task
            </button>
          )}
          {isEdit && confirmingDelete && (
            <div className="task-delete-confirm">
              <span>Delete this task?</span>
              <button type="button" className="task-btn-ghost" onClick={() => setConfirmingDelete(false)}>Cancel</button>
              <button type="button" className="task-btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
