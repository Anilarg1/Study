import { useState, useEffect, useCallback, useMemo } from 'react'
import useAuthStore from '../store/useAuthStore'
import { usePlannerStore } from '../store/usePlannerStore'
import useGoalsStore from '../store/useGoalsStore'
import useSubjectStore from '../store/useSubjectStore'
import { TaskCreateModal } from '../components/planner/TaskCreateModal'
import type { Task } from '../types'
import {
  parseISODate, toISODate, todayISO, getMonday, addDays, weekDays,
} from '../lib/planner'
import './PlannerPage.css'

// ── helpers ───────────────────────────────────────────────────────────────────

const WD_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WD_LONG  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_NAMES_FULL = ['January','February','March','April','May','June',
                          'July','August','September','October','November','December']

function fmt(min: number): string {
  const h = Math.floor(min / 60), m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function fmtHour(min: number): string {
  const h = Math.floor(min / 60)
  const ap = h < 12 ? 'AM' : 'PM'
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh} ${ap}`
}

function fmtDur(m: number): string {
  if (m >= 60) {
    const h = Math.floor(m / 60), rem = m % 60
    return rem ? `${h}h ${rem}m` : `${h}h`
  }
  return `${m}m`
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Day index 0..6 relative to weekStart, or -1 if outside current week
function weekDayIdx(dateISO: string, weekStartISO: string): number {
  const d = parseISODate(dateISO)
  const s = parseISODate(weekStartISO)
  const diff = Math.round((d.getTime() - s.getTime()) / (1000 * 60 * 60 * 24))
  return diff >= 0 && diff < 7 ? diff : -1
}

function nowMinutes(): number {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}

// ── types ─────────────────────────────────────────────────────────────────────

interface Block {
  id:        string
  day:       number
  s:         number
  e:         number
  subjectId: string | null
  title:     string
  done:      boolean
}

interface SubjectInfo {
  id:    string
  name:  string
  color: string
}

interface WeekInfo {
  weekDates: string[]   // 7 ISO dates Mon..Sun
  dayNums:   number[]   // day-of-month for each
  todayIdx:  number     // 0..6 or -1
  rangeMain: string
  rangeSub:  string
}

interface MonthCell {
  idx:       number
  col:       number
  dateISO:   string
  dateNum:   number
  inMonth:   boolean
  isWeekend: boolean
}

// ── data helpers ──────────────────────────────────────────────────────────────

const BLOCK_DUR = 60   // default block duration (minutes)
const START_HOUR = 8
const END_HOUR   = 21
const HH         = 54  // hour height px

function tasksToBlocks(tasks: Task[], weekStartISO: string): Block[] {
  return tasks
    .filter(t => t.due_time != null)
    .flatMap(t => {
      const day = weekDayIdx(t.due_date, weekStartISO)
      if (day < 0) return []
      const s = timeToMin(t.due_time!)
      return [{ id: t.id, day, s, e: s + BLOCK_DUR, subjectId: t.subject_id, title: t.title, done: !!t.completed_at }]
    })
}

function computeWeekInfo(weekStartISO: string): WeekInfo {
  const wDates  = weekDays(weekStartISO)
  const dayNums = wDates.map(d => parseISODate(d).getDate())
  const todayStr= todayISO()
  const todayIdx= weekDayIdx(todayStr, weekStartISO)

  const first = parseISODate(wDates[0])
  const last  = parseISODate(wDates[6])
  const rangeMain = first.getMonth() === last.getMonth()
    ? `${dayNums[0]} – ${dayNums[6]} ${MONTH_NAMES[first.getMonth()]}`
    : `${dayNums[0]} ${MONTH_NAMES[first.getMonth()]} – ${dayNums[6]} ${MONTH_NAMES[last.getMonth()]}`

  return { weekDates: wDates, dayNums, todayIdx, rangeMain, rangeSub: String(first.getFullYear()) }
}

function computeMonthCells(weekStartISO: string): { cells: MonthCell[]; year: number; month: number } {
  const ref  = parseISODate(weekStartISO)
  const year = ref.getFullYear()
  const month= ref.getMonth()

  const firstDay  = new Date(year, month, 1)
  let startCol    = firstDay.getDay()            // 0=Sun, 1=Mon...
  startCol        = startCol === 0 ? 6 : startCol - 1  // Mon=0

  const daysInMonth= new Date(year, month + 1, 0).getDate()
  const totalCells = Math.ceil((startCol + daysInMonth) / 7) * 7

  const cells: MonthCell[] = []
  for (let i = 0; i < totalCells; i++) {
    const col       = i % 7
    const dayOffset = i - startCol
    const date      = new Date(year, month, 1 + dayOffset)
    cells.push({
      idx:       i,
      col,
      dateISO:   toISODate(date),
      dateNum:   date.getDate(),
      inMonth:   dayOffset >= 0 && dayOffset < daysInMonth,
      isWeekend: col >= 5,
    })
  }
  return { cells, year, month }
}

// ── mini icons ────────────────────────────────────────────────────────────────

function SvgChevL() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
}
function SvgChevR() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
}
function SvgWeek() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>
}
function SvgGrid() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
}
function SvgRows() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>
}
function SvgCols() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="6" height="16" rx="1.5"/><rect x="15" y="4" width="6" height="16" rx="1.5"/></svg>
}
function SvgPlus() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
}
function SvgCheck() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17.5 19.5 7"/></svg>
}

const VIEWS = [
  { id: 'week'    as const, label: 'Week',    Icon: SvgWeek, kbd: '1' },
  { id: 'month'   as const, label: 'Month',   Icon: SvgGrid, kbd: '2' },
  { id: 'day'     as const, label: 'Day',     Icon: SvgRows, kbd: '3' },
  { id: 'planner' as const, label: 'Planner', Icon: SvgCols, kbd: '4' },
]
type ViewId = 'week' | 'month' | 'day' | 'planner'

// ── WeekGrid ──────────────────────────────────────────────────────────────────

interface WeekGridProps {
  blocks:   Block[]
  weekInfo: WeekInfo
  subjMap:  Record<string, SubjectInfo>
  todayIdx: number
}

function WeekGrid({ blocks, weekInfo, subjMap, todayIdx }: WeekGridProps) {
  const pxMin    = HH / 60
  const top0     = START_HOUR * 60
  const totalMin = (END_HOUR - START_HOUR) * 60
  const H        = totalMin * pxMin
  const nowMin   = nowMinutes()
  const hours    = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)

  function renderBlock(b: Block) {
    const color  = b.subjectId ? (subjMap[b.subjectId]?.color ?? '#8b85ff') : '#8b85ff'
    const top    = (b.s - top0) * pxMin
    const height = (b.e - b.s) * pxMin
    if (top + height < 0 || top > H) return null
    const tiny   = height < 30
    const noTime = height < 46
    return (
      <div
        key={b.id}
        className={`wk-evt${tiny ? ' tiny' : noTime ? ' compact' : ''}${b.done ? ' done' : ''}`}
        style={{ top: Math.max(top, 0), height: Math.max(height, 18), '--ec': color } as React.CSSProperties}
        title={`${b.title} · ${fmt(b.s)}–${fmt(b.e)}`}
      >
        <span className="wk-evt-title">{b.title}</span>
        {!tiny && <span className="wk-evt-time">{fmt(b.s)}–{fmt(b.e)}</span>}
        {tiny  && <span className="wk-evt-time">{fmt(b.s)}</span>}
      </div>
    )
  }

  const cssVars = {
    '--gutter': '52px',
    '--cols': '7',
    '--hh': `${HH}px`,
  } as React.CSSProperties

  return (
    <div className="wk" style={cssVars}>
      <div className="wk-heads">
        <div className="wk-corner" />
        {[0,1,2,3,4,5,6].map(d => (
          <div key={d} className={`wk-dh${d === todayIdx ? ' today' : ''}`}>
            <div className="wk-dh-day">{WD_SHORT[d]}</div>
            <div className="wk-dh-num">{weekInfo.dayNums[d]}</div>
          </div>
        ))}
      </div>
      <div className="pl-scroll">
        <div className="wk-grid">
          <div className="wk-gutter" style={{ height: H }}>
            {hours.map(h => (
              <div key={h} className="wk-hourlabel" style={{ top: (h * 60 - top0) * pxMin }}>
                {fmtHour(h * 60)}
              </div>
            ))}
          </div>
          {[0,1,2,3,4,5,6].map(d => (
            <div
              key={d}
              className={`wk-col${d === todayIdx ? ' today' : ''}${d >= 5 ? ' weekend' : ''}`}
              style={{ height: H }}
            >
              {blocks.filter(b => b.day === d).map(renderBlock)}
              {d === todayIdx && nowMin >= top0 && nowMin <= END_HOUR * 60 && (
                <div className="wk-now" style={{ top: (nowMin - top0) * pxMin }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── MonthView ─────────────────────────────────────────────────────────────────

interface MonthViewProps {
  tasks:    Task[]
  weekStart: string
  subjMap:  Record<string, SubjectInfo>
  subjOff:  Record<string, boolean>
}

function MonthView({ tasks, weekStart, subjMap, subjOff }: MonthViewProps) {
  const { cells, year, month } = useMemo(() => computeMonthCells(weekStart), [weekStart])
  const todayStr = todayISO()

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {}
    tasks.forEach(t => {
      ;(map[t.due_date] ??= []).push(t)
    })
    return map
  }, [tasks])

  function chip(t: Task) {
    const color = t.subject_id ? (subjMap[t.subject_id]?.color ?? '#8b85ff') : '#8b85ff'
    return (
      <div
        key={t.id}
        className="mo-chip"
        style={{ '--ec': color } as React.CSSProperties}
        title={`${t.title}${t.due_time ? ' · ' + t.due_time : ''}`}
      >
        <span className="mc-dot" />
        {t.due_time && <span className="mc-time">{fmt(timeToMin(t.due_time))}</span>}
        <span className="mc-title">{t.title}</span>
      </div>
    )
  }

  return (
    <div className="mo">
      <div className="mo-monthhead">{MONTH_NAMES_FULL[month]} {year}</div>
      <div className="mo-weekhead">
        {WD_SHORT.map(d => <div key={d} className="mo-wd">{d}</div>)}
      </div>
      <div className="mo-grid">
        {cells.map(cell => {
          const evs = (tasksByDate[cell.dateISO] ?? [])
            .filter(t => !t.subject_id || !subjOff[t.subject_id])
            .sort((a, b) => (a.due_time ?? '').localeCompare(b.due_time ?? ''))
          const isToday = cell.dateISO === todayStr
          const shown   = evs.slice(0, 3)
          const more    = evs.length - shown.length
          return (
            <div
              key={cell.idx}
              className={`mo-cell${!cell.inMonth ? ' other' : ''}${cell.isWeekend ? ' weekend' : ''}${isToday ? ' today' : ''}`}
            >
              <span className="mo-num">{cell.dateNum}</span>
              {shown.map(chip)}
              {more > 0 && <span className="mo-more">+{more} more</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── DayAgenda ─────────────────────────────────────────────────────────────────

interface DayAgendaProps {
  blocks:     Block[]
  allBlocks:  Block[]
  weekInfo:   WeekInfo
  subjMap:    Record<string, SubjectInfo>
  todayIdx:   number
  selectedDay: number
  onPickDay:  (d: number) => void
}

function DayAgenda({ blocks, allBlocks, weekInfo, subjMap, todayIdx, selectedDay, onPickDay }: DayAgendaProps) {
  const dhh    = 58
  const pxMin  = dhh / 60
  const top0   = START_HOUR * 60
  const H      = (END_HOUR - START_HOUR) * 60 * pxMin
  const isToday= selectedDay === todayIdx
  const nowMin = nowMinutes()
  const hours  = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)

  const dayBlocks = blocks.filter(b => b.day === selectedDay).sort((a, b) => a.s - b.s)
  const focusMin  = dayBlocks.reduce((a, b) => a + (b.e - b.s), 0)
  const upNext    = isToday ? dayBlocks.find(b => b.e > nowMin) : dayBlocks[0]

  function dayDots(d: number) {
    const subs = [...new Set(allBlocks.filter(b => b.day === d).map(b => b.subjectId).filter(Boolean))]
    return (subs as string[]).slice(0, 3).map(sid => (
      <i key={sid} style={{ background: subjMap[sid]?.color ?? '#8b85ff' }} />
    ))
  }

  return (
    <div className="day">
      <aside className="day-rail">
        <div>
          <div className="day-minihd">{WD_LONG[selectedDay]}</div>
          <div style={{ fontFamily: 'monospace', fontSize: 11.5, color: 'var(--text-mute)', marginTop: 2 }}>
            {weekInfo.dayNums[selectedDay]} · {weekInfo.rangeSub}{isToday ? ' · Today' : ''}
          </div>
        </div>

        <div className="day-weekstrip">
          {[0,1,2,3,4,5,6].map(d => (
            <button key={d} className={`day-pick${d === selectedDay ? ' sel' : ''}`} onClick={() => onPickDay(d)}>
              <span className="dp-wd">{WD_SHORT[d][0]}</span>
              <span className="dp-num">{weekInfo.dayNums[d]}</span>
              <span className="dp-dots">{dayDots(d)}</span>
            </button>
          ))}
        </div>

        <div className="day-stat">
          <div><div className="ds-k">{fmtDur(focusMin) || '0m'}</div><div className="ds-l">planned</div></div>
          <div><div className="ds-k">{dayBlocks.length}</div><div className="ds-l">blocks</div></div>
        </div>

        {upNext && (() => {
          const color = upNext.subjectId ? (subjMap[upNext.subjectId]?.color ?? 'var(--focus)') : 'var(--focus)'
          const name  = upNext.subjectId ? (subjMap[upNext.subjectId]?.name ?? 'Task') : 'Task'
          return (
            <div className="day-up" style={{ '--accent': color } as React.CSSProperties}>
              <span className="du-l">{isToday ? 'Up next' : 'First up'}</span>
              <span className="du-t">{upNext.title}</span>
              <span className="du-m">{fmt(upNext.s)}–{fmt(upNext.e)} · {name}</span>
            </div>
          )
        })()}
      </aside>

      <div className="day-timeline">
        <div className="day-grid">
          <div className="day-gutter" style={{ height: H }}>
            {hours.map(h => (
              <div key={h} className="day-hourlabel" style={{ top: (h * 60 - top0) * pxMin }}>
                {fmtHour(h * 60)}
              </div>
            ))}
          </div>
          <div className="day-track" style={{ height: H, '--dhh': `${dhh}px` } as React.CSSProperties}>
            {dayBlocks.map(b => {
              const color = b.subjectId ? (subjMap[b.subjectId]?.color ?? '#8b85ff') : '#8b85ff'
              const name  = b.subjectId ? (subjMap[b.subjectId]?.name ?? '') : ''
              const top    = (b.s - top0) * pxMin
              const height = (b.e - b.s) * pxMin
              return (
                <div
                  key={b.id}
                  className={`devt${b.done ? ' done' : ''}`}
                  style={{ top: Math.max(top, 0), height: Math.max(height, 34), '--ec': color } as React.CSSProperties}
                >
                  <div className="devt-top">
                    <span className="devt-title">{b.title}</span>
                    {name && <span className="devt-tag">{name}</span>}
                  </div>
                  <span className="devt-time">{fmt(b.s)}–{fmt(b.e)} · {fmtDur(b.e - b.s)}</span>
                </div>
              )
            })}
            {isToday && nowMin >= top0 && nowMin <= END_HOUR * 60 && (
              <div className="day-now" style={{ top: (nowMin - top0) * pxMin }}>
                <span className="dn-time">{fmt(nowMin)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── TaskBoard ─────────────────────────────────────────────────────────────────

interface TaskBoardProps {
  tasks:      Task[]
  weekInfo:   WeekInfo
  subjMap:    Record<string, SubjectInfo>
  subjOff:    Record<string, boolean>
  onToggle:   (id: string) => void
  onCreate:   (date: string) => void
  todayIdx:   number
}

function TaskBoard({ tasks, weekInfo, subjMap, subjOff, onToggle, onCreate, todayIdx }: TaskBoardProps) {
  function card(t: Task) {
    const color = t.subject_id ? (subjMap[t.subject_id]?.color ?? '#8b85ff') : '#8b85ff'
    const name  = t.subject_id ? (subjMap[t.subject_id]?.name ?? '') : ''
    return (
      <div key={t.id} className={`tp-card${t.completed_at ? ' done' : ''}`} onClick={() => onToggle(t.id)}>
        <button className="tp-check" onClick={e => { e.stopPropagation(); onToggle(t.id) }} aria-label="toggle">
          {t.completed_at && <SvgCheck />}
        </button>
        <div className="tp-body">
          <span className="tp-title">{t.title}</span>
          <div className="tp-meta">
            {name && (
              <span className="tp-subj">
                <span className="ts-dot" style={{ background: color }} />
                {name}
              </span>
            )}
            {t.due_time && <span className="tp-due">{t.due_time}</span>}
          </div>
        </div>
      </div>
    )
  }

  function column(
    key: number | 'backlog',
    label: string,
    sub: string | null,
    list: Task[],
    isToday: boolean,
    dateForNew: string,
  ) {
    const filtered = list.filter(t => !t.subject_id || !subjOff[t.subject_id])
    const open = filtered.filter(t => !t.completed_at).length
    return (
      <div key={String(key)} className={`tp-col${key === 'backlog' ? ' backlog' : ''}`}>
        <div className={`tp-colhd${isToday ? ' today' : ''}`}>
          <span className="tch-wd">{label}</span>
          {sub && <span className="tch-num">{sub}</span>}
          <span className="tch-count">{open}</span>
        </div>
        <div className="tp-list">
          {filtered.map(card)}
          <button className="tp-add" onClick={() => onCreate(dateForNew)}>
            <SvgPlus /> Add task
          </button>
        </div>
      </div>
    )
  }

  // Bucket tasks by weekday, backlog for outside this week
  const buckets: Record<number, Task[]> = { 0:[], 1:[], 2:[], 3:[], 4:[], 5:[], 6:[] }
  const backlog: Task[] = []
  tasks.forEach(t => {
    const d = weekDayIdx(t.due_date, weekInfo.weekDates[0])
    if (d >= 0 && d < 7) buckets[d].push(t)
    else backlog.push(t)
  })

  return (
    <div className="tp">
      <div className="tp-board">
        {[0,1,2,3,4,5,6].map(d => column(
          d, WD_SHORT[d], String(weekInfo.dayNums[d]),
          buckets[d], d === todayIdx, weekInfo.weekDates[d],
        ))}
        {column('backlog', 'Backlog', null, backlog, false, weekInfo.weekDates[0])}
      </div>
    </div>
  )
}

// ── PlannerPage ───────────────────────────────────────────────────────────────

export function PlannerPage() {
  const user         = useAuthStore(s => s.user)
  const tasks        = usePlannerStore(s => s.tasks)
  const weekStart    = usePlannerStore(s => s.weekStart)
  const setWeekStart = usePlannerStore(s => s.setWeekStart)
  const loadTasks    = usePlannerStore(s => s.loadTasks)
  const completeTask = usePlannerStore(s => s.completeTask)
  const fetchGoals   = useGoalsStore(s => s.fetchGoals)
  const subjects     = useSubjectStore(s => s.subjects)

  const [view, setView] = useState<ViewId>(
    () => (localStorage.getItem('timetable.view') as ViewId | null) ?? 'week'
  )
  const [selectedDay, setSelectedDay] = useState(0)
  const [subjOff, setSubjOff] = useState<Record<string, boolean>>({})
  const [createModal, setCreateModal] = useState<{ date: string; time: string | null } | null>(null)

  useEffect(() => { localStorage.setItem('timetable.view', view) }, [view])

  useEffect(() => {
    if (!user) return
    loadTasks(user.id)
    fetchGoals(user.id)
  }, [user, loadTasks, fetchGoals])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).matches('input, textarea')) return
      if (e.key === '1') setView('week')
      else if (e.key === '2') setView('month')
      else if (e.key === '3') setView('day')
      else if (e.key === '4') setView('planner')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const weekInfo = useMemo(() => computeWeekInfo(weekStart), [weekStart])
  const subjMap  = useMemo(
    () => Object.fromEntries(subjects.map(s => [s.id, { id: s.id, name: s.name, color: s.color }])),
    [subjects],
  )
  const allBlocks = useMemo(() => tasksToBlocks(tasks, weekStart), [tasks, weekStart])
  const fBlocks   = allBlocks.filter(b => !b.subjectId || !subjOff[b.subjectId])
  const fTasks    = tasks.filter(t => !t.subject_id || !subjOff[t.subject_id])

  // Pin selected day to today when week changes
  useEffect(() => {
    if (weekInfo.todayIdx >= 0) setSelectedDay(weekInfo.todayIdx)
  }, [weekInfo.todayIdx])

  const toggleSubj = useCallback((id: string) => setSubjOff(o => ({ ...o, [id]: !o[id] })), [])

  function nav(dir: -1 | 1) {
    if (view === 'day') {
      setSelectedDay(d => Math.max(0, Math.min(6, d + dir)))
    } else {
      setWeekStart(addDays(weekStart, dir * 7))
    }
  }

  function goToday() {
    const today  = todayISO()
    const monday = getMonday(today)
    setWeekStart(monday)
    if (view === 'day') {
      const idx = weekDayIdx(today, monday)
      setSelectedDay(idx >= 0 ? idx : 0)
    }
  }

  // Date range label for the bar
  let rangeMain = weekInfo.rangeMain
  if (view === 'day') {
    const d = parseISODate(weekInfo.weekDates[selectedDay] ?? weekInfo.weekDates[0])
    rangeMain = `${WD_SHORT[selectedDay]} ${weekInfo.dayNums[selectedDay]} ${MONTH_NAMES[d.getMonth()]}`
  }

  return (
    <div className="pl-main">

      {/* ── control bar ── */}
      <div className="pl-bar">
        <div className="pl-viewtabs">
          {VIEWS.map(v => (
            <button
              key={v.id}
              className={`pl-viewtab${view === v.id ? ' active' : ''}`}
              onClick={() => setView(v.id)}
            >
              <span className="vt-ic"><v.Icon /></span>
              {v.label}
              <span className="vt-kbd">{v.kbd}</span>
            </button>
          ))}
        </div>

        <div className="pl-datenav">
          <button className="pl-navbtn" onClick={() => nav(-1)} title="Previous"><SvgChevL /></button>
          <button className="pl-today" onClick={goToday}>Today</button>
          <button className="pl-navbtn" onClick={() => nav(1)} title="Next"><SvgChevR /></button>
        </div>
        <span className="pl-range">
          {rangeMain}
          <span className="pl-range-sub">{weekInfo.rangeSub}</span>
        </span>

        <div className="pl-spacer" />

        {subjects.length > 0 && (
          <div className="pl-filters">
            {subjects.map(s => (
              <button
                key={s.id}
                className={`pl-filterpill${subjOff[s.id] ? ' off' : ''}`}
                onClick={() => toggleSubj(s.id)}
                title={`Toggle ${s.name}`}
              >
                <span className="fp-dot" style={{ background: s.color }} />
                {s.name.length > 5 ? s.name.slice(0, 4) + '…' : s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── views ── */}
      {view === 'week' && (
        <WeekGrid
          blocks={fBlocks}
          weekInfo={weekInfo}
          subjMap={subjMap}
          todayIdx={weekInfo.todayIdx}
        />
      )}
      {view === 'month' && (
        <MonthView
          tasks={fTasks}
          weekStart={weekStart}
          subjMap={subjMap}
          subjOff={subjOff}
        />
      )}
      {view === 'day' && (
        <DayAgenda
          blocks={fBlocks}
          allBlocks={allBlocks}
          weekInfo={weekInfo}
          subjMap={subjMap}
          todayIdx={weekInfo.todayIdx}
          selectedDay={selectedDay}
          onPickDay={setSelectedDay}
        />
      )}
      {view === 'planner' && (
        <TaskBoard
          tasks={fTasks}
          weekInfo={weekInfo}
          subjMap={subjMap}
          subjOff={subjOff}
          onToggle={completeTask}
          onCreate={(date) => setCreateModal({ date, time: null })}
          todayIdx={weekInfo.todayIdx}
        />
      )}

      {createModal && (
        <TaskCreateModal
          defaultDate={createModal.date}
          defaultTime={createModal.time}
          onClose={() => setCreateModal(null)}
        />
      )}
    </div>
  )
}

export default PlannerPage
