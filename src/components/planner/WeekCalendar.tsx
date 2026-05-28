import { useState } from 'react'
import { usePlannerStore } from '../../store/usePlannerStore'
import useSubjectStore from '../../store/useSubjectStore'
import { weekDays, addDays, getMonday, todayISO, parseISODate } from '../../lib/planner'
import { TaskBlock } from './TaskBlock'
import { TaskChip } from './TaskChip'
import { TaskCreateModal } from './TaskCreateModal'
import type { Task } from '../../types'
import './WeekCalendar.css'

const START_HOUR = 6      // 6am
const END_HOUR = 23       // 11pm
const HOUR_PX = 48
const BLOCK_MINUTES = 60  // fixed display height for timed tasks

const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)

function hourLabel(h: number): string {
  const period = h >= 12 ? 'pm' : 'am'
  let hh = h % 12
  if (hh === 0) hh = 12
  return `${hh}${period}`
}

function minutesFromStart(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h - START_HOUR) * 60 + m
}

export function WeekCalendar() {
  const weekStart = usePlannerStore((s) => s.weekStart)
  const setWeekStart = usePlannerStore((s) => s.setWeekStart)
  const tasks = usePlannerStore((s) => s.tasks)
  const subjects = useSubjectStore((s) => s.subjects)

  const [modal, setModal] = useState<
    | { mode: 'create'; date: string; time: string | null }
    | { mode: 'edit'; task: Task }
    | null
  >(null)

  const days = weekDays(weekStart)
  const today = todayISO()

  function subjectColor(id: string | null): string | null {
    if (!id) return null
    return subjects.find((s) => s.id === id)?.color ?? null
  }

  function tasksForDay(day: string) {
    const dayTasks = tasks.filter((t) => t.due_date === day)
    return {
      allDay: dayTasks.filter((t) => !t.due_time),
      timed: dayTasks.filter((t) => t.due_time),
    }
  }

  return (
    <div className="week-calendar">
      <div className="week-toolbar">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">‹</button>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">›</button>
        <button className="week-today-btn" onClick={() => setWeekStart(getMonday(today))}>Today</button>
      </div>

      <div className="week-grid">
        {/* Column 0: hour gutter */}
        <div className="week-gutter">
          <div className="week-corner" />
          <div className="week-allday-gutter">all-day</div>
          <div className="week-hours">
            {HOURS.map((h) => (
              <div key={h} className="week-hour-label" style={{ height: `${HOUR_PX}px` }}>{hourLabel(h)}</div>
            ))}
          </div>
        </div>

        {/* Day columns */}
        {days.map((day) => {
          const { allDay, timed } = tasksForDay(day)
          const d = parseISODate(day)
          const isToday = day === today
          return (
            <div key={day} className={`week-col${isToday ? ' today' : ''}`}>
              <div className="week-col-head">
                <span className="week-dow">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                <span className="week-date">{d.getDate()}</span>
              </div>

              <div className="week-allday">
                {allDay.map((t) => (
                  <TaskChip
                    key={t.id}
                    task={t}
                    color={subjectColor(t.subject_id)}
                    onClick={() => setModal({ mode: 'edit', task: t })}
                  />
                ))}
              </div>

              <div className="week-day-body" style={{ height: `${HOURS.length * HOUR_PX}px` }}>
                {/* clickable hour slots */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="week-slot"
                    style={{ height: `${HOUR_PX}px` }}
                    onClick={() => setModal({ mode: 'create', date: day, time: `${String(h).padStart(2, '0')}:00` })}
                  />
                ))}
                {/* timed blocks */}
                {timed.map((t) => {
                  const top = (minutesFromStart(t.due_time!) / 60) * HOUR_PX
                  const height = (BLOCK_MINUTES / 60) * HOUR_PX
                  return (
                    <TaskBlock
                      key={t.id}
                      task={t}
                      color={subjectColor(t.subject_id)}
                      top={top}
                      height={height}
                      onClick={() => setModal({ mode: 'edit', task: t })}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {modal?.mode === 'create' && (
        <TaskCreateModal defaultDate={modal.date} defaultTime={modal.time} onClose={() => setModal(null)} />
      )}
      {modal?.mode === 'edit' && (
        <TaskCreateModal task={modal.task} onClose={() => setModal(null)} />
      )}
    </div>
  )
}
