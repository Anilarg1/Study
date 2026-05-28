import type { Task, RecurrenceRule } from '../types'

// All date helpers operate on ISO 'YYYY-MM-DD' strings interpreted in LOCAL time.

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function getMonday(iso: string): string {
  const d = parseISODate(iso)
  const dow = d.getDay()          // 0=Sun .. 6=Sat
  const diff = (dow + 6) % 7      // days since Monday
  d.setDate(d.getDate() - diff)
  return toISODate(d)
}

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function weekDays(mondayIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayIso, i))
}

export function timestampToLocalISODate(ts: string): string {
  return toISODate(new Date(ts))
}

// '19:00' -> '7pm', '09:30' -> '9:30am', '12:00' -> '12pm', '00:00' -> '12am'
export function formatTime12h(time: string): string {
  const [hStr, mStr] = time.split(':')
  let h = Number(hStr)
  const m = Number(mStr)
  const period = h >= 12 ? 'pm' : 'am'
  h = h % 12
  if (h === 0) h = 12
  return m === 0 ? `${h}${period}` : `${h}:${String(m).padStart(2, '0')}${period}`
}

export function nextOccurrence(iso: string, rule: RecurrenceRule): string {
  const d = parseISODate(iso)
  if (rule === 'daily') d.setDate(d.getDate() + 1)
  else if (rule === 'weekly') d.setDate(d.getDate() + 7)
  else d.setMonth(d.getMonth() + 1) // monthly
  return toISODate(d)
}

// Sort: timed tasks before untimed; earlier time first; then priority ascending (1 = most urgent).
export function sortTasks(a: Task, b: Task): number {
  if (a.due_time && b.due_time) {
    if (a.due_time !== b.due_time) return a.due_time.localeCompare(b.due_time)
  } else if (a.due_time && !b.due_time) {
    return -1
  } else if (!a.due_time && b.due_time) {
    return 1
  }
  return a.priority - b.priority
}

export interface BucketedTasks {
  overdue:  Task[]
  today:    Task[]
  tomorrow: Task[]
  thisWeek: Task[]
  later:    Task[]
}

export function groupTasks(tasks: Task[], today: string): BucketedTasks {
  const out: BucketedTasks = { overdue: [], today: [], tomorrow: [], thisWeek: [], later: [] }
  const tomorrow = addDays(today, 1)
  const weekEnd = addDays(getMonday(today), 6)

  for (const t of tasks) {
    // Completed tasks: visible only on the calendar day they were completed; gone the next day.
    if (t.completed_at) {
      if (timestampToLocalISODate(t.completed_at) !== today) continue
      // A task completed today belongs in 'today' regardless of its original due date.
      out.today.push(t)
      continue
    }
    if (t.due_date < today) out.overdue.push(t)
    else if (t.due_date === today) out.today.push(t)
    else if (t.due_date === tomorrow) out.tomorrow.push(t)
    else if (t.due_date <= weekEnd) out.thisWeek.push(t)
    else out.later.push(t)
  }

  for (const key of Object.keys(out) as (keyof BucketedTasks)[]) {
    out[key].sort(sortTasks)
  }
  return out
}
