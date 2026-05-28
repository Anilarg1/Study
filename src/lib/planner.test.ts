import { describe, it, expect } from 'vitest'
import {
  toISODate,
  parseISODate,
  getMonday,
  addDays,
  weekDays,
  formatTime12h,
  nextOccurrence,
  timestampToLocalISODate,
  groupTasks,
  sortTasks,
} from './planner'
import type { Task } from '../types'

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: Math.random().toString(),
    user_id: 'u1',
    subject_id: null,
    title: 'Task',
    notes: null,
    due_date: '2026-05-28',
    due_time: null,
    priority: 4,
    is_recurring: false,
    recurrence: null,
    completed_at: null,
    created_at: '2026-05-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('date helpers', () => {
  it('round-trips a date through toISODate/parseISODate', () => {
    expect(toISODate(parseISODate('2026-05-28'))).toBe('2026-05-28')
  })

  it('getMonday returns the Monday of the week', () => {
    expect(getMonday('2026-05-28')).toBe('2026-05-25') // Thu -> Mon
    expect(getMonday('2026-05-25')).toBe('2026-05-25') // Mon -> Mon
    expect(getMonday('2026-05-31')).toBe('2026-05-25') // Sun -> Mon
  })

  it('addDays handles month rollover', () => {
    expect(addDays('2026-05-31', 1)).toBe('2026-06-01')
    expect(addDays('2026-05-01', -1)).toBe('2026-04-30')
  })

  it('weekDays returns 7 consecutive days from Monday', () => {
    expect(weekDays('2026-05-25')).toEqual([
      '2026-05-25', '2026-05-26', '2026-05-27', '2026-05-28',
      '2026-05-29', '2026-05-30', '2026-05-31',
    ])
  })
})

describe('formatTime12h', () => {
  it('formats on-the-hour times without minutes', () => {
    expect(formatTime12h('19:00')).toBe('7pm')
    expect(formatTime12h('00:00')).toBe('12am')
    expect(formatTime12h('12:00')).toBe('12pm')
    expect(formatTime12h('06:00')).toBe('6am')
  })
  it('includes minutes when non-zero', () => {
    expect(formatTime12h('09:30')).toBe('9:30am')
    expect(formatTime12h('23:05')).toBe('11:05pm')
  })
})

describe('nextOccurrence', () => {
  it('advances by the recurrence interval', () => {
    expect(nextOccurrence('2026-05-28', 'daily')).toBe('2026-05-29')
    expect(nextOccurrence('2026-05-28', 'weekly')).toBe('2026-06-04')
    expect(nextOccurrence('2026-01-31', 'monthly')).toBe('2026-03-03') // JS month rollover
  })
})

describe('groupTasks', () => {
  const today = '2026-05-28'

  it('buckets by due date relative to today', () => {
    const tasks = [
      makeTask({ due_date: '2026-05-26' }),            // overdue
      makeTask({ due_date: '2026-05-28' }),            // today
      makeTask({ due_date: '2026-05-29' }),            // tomorrow
      makeTask({ due_date: '2026-05-31' }),            // this week (Sun)
      makeTask({ due_date: '2026-06-10' }),            // later
    ]
    const g = groupTasks(tasks, today)
    expect(g.overdue).toHaveLength(1)
    expect(g.today).toHaveLength(1)
    expect(g.tomorrow).toHaveLength(1)
    expect(g.thisWeek).toHaveLength(1)
    expect(g.later).toHaveLength(1)
  })

  it('hides tasks completed before today', () => {
    const t = makeTask({ due_date: '2026-05-26', completed_at: '2026-05-26T10:00:00.000Z' })
    const g = groupTasks([t], today)
    expect(g.overdue).toHaveLength(0)
    expect(g.today).toHaveLength(0)
  })

  it('keeps tasks completed today in the today bucket even if overdue', () => {
    const completedAt = new Date(2026, 4, 28, 10, 0).toISOString() // local 2026-05-28
    const t = makeTask({ due_date: '2026-05-26', completed_at: completedAt })
    const g = groupTasks([t], today)
    expect(g.today).toHaveLength(1)
    expect(g.overdue).toHaveLength(0)
  })
})

describe('sortTasks', () => {
  it('orders timed before untimed, then by time, then by priority', () => {
    const untimed = makeTask({ due_time: null, priority: 1 })
    const at7 = makeTask({ due_time: '07:00', priority: 4 })
    const at9 = makeTask({ due_time: '09:00', priority: 4 })
    const sorted = [untimed, at9, at7].sort(sortTasks)
    expect(sorted[0]).toBe(at7)
    expect(sorted[1]).toBe(at9)
    expect(sorted[2]).toBe(untimed)
  })

  it('breaks ties by priority ascending (1 most urgent)', () => {
    const p4 = makeTask({ due_time: null, priority: 4 })
    const p1 = makeTask({ due_time: null, priority: 1 })
    expect([p4, p1].sort(sortTasks)[0]).toBe(p1)
  })
})

describe('timestampToLocalISODate', () => {
  it('extracts the local calendar date from a timestamp', () => {
    const ts = new Date(2026, 4, 28, 23, 30).toISOString()
    expect(timestampToLocalISODate(ts)).toBe('2026-05-28')
  })
})
