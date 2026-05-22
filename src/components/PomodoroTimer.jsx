import { useEffect, useRef, useState, useCallback } from 'react'
import useTimerStore from '../store/useTimerStore'
import useXPStore from '../store/useXPStore'
import XPBar from './XPBar'
import SubjectPicker from './SubjectPicker'
import clsx from 'clsx'

// ─── tiny helpers ────────────────────────────────────────────────────────────

function fmt(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

const MODE_LABELS = {
  work:       'Focus',
  shortBreak: 'Short Break',
  longBreak:  'Long Break',
}

const MODE_COLORS = {
  work:       'text-accent',
  shortBreak: 'text-green',
  longBreak:  'text-amber',
}

const MODE_RING = {
  work:       'stroke-[#7c6af0]',
  shortBreak: 'stroke-[#4ade80]',
  longBreak:  'stroke-[#fbbf24]',
}

// SVG ring constants
const R  = 88   // radius
const CX = 100  // cx / cy
const CIRC = 2 * Math.PI * R   // ≈ 552.9

// ─── component ───────────────────────────────────────────────────────────────

const DURATION_LABELS = {
  work:       'Focus',
  shortBreak: 'Short Break',
  longBreak:  'Long Break',
}

export default function PomodoroTimer() {
  const {
    mode, remaining, running, completedWork, subjectId, customDurations,
    start, pause, reset, setMode, setDuration, tick,
  } = useTimerStore()

  const awardXP = useXPStore(s => s.awardXP)

  // Flash state for XP bar + level-up toast
  const [xpFlash,      setXpFlash]      = useState(false)
  const [toast,        setToast]        = useState(null)   // { msg, key }
  const [showSettings, setShowSettings] = useState(false)
  // Local draft values for the settings inputs (in minutes)
  const [draftMins,    setDraftMins]    = useState({
    work:       customDurations.work       / 60,
    shortBreak: customDurations.shortBreak / 60,
    longBreak:  customDurations.longBreak  / 60,
  })
  const tickRef = useRef(null)

  // Keep drafts in sync when the store changes externally
  useEffect(() => {
    setDraftMins({
      work:       customDurations.work       / 60,
      shortBreak: customDurations.shortBreak / 60,
      longBreak:  customDurations.longBreak  / 60,
    })
  }, [customDurations.work, customDurations.shortBreak, customDurations.longBreak])

  // ── ticker ──────────────────────────────────────────────────────────────────
  const handleTick = useCallback(() => {
    const finished = tick()
    if (finished) {
      const result = awardXP(mode, subjectId)   // mode + subject that just finished
      setXpFlash(true)
      setTimeout(() => setXpFlash(false), 800)

      const msg = result.leveledUp
        ? `🎉 Level up! You're now Level ${result.newLevel}`
        : `+${result.xp} XP`

      setToast({ msg, key: Date.now() })
      setTimeout(() => setToast(null), 3000)
    }
  }, [tick, awardXP, mode, subjectId])

  useEffect(() => {
    if (running) {
      tickRef.current = setInterval(handleTick, 1000)
    } else {
      clearInterval(tickRef.current)
    }
    return () => clearInterval(tickRef.current)
  }, [running, handleTick])

  // ── document title ──────────────────────────────────────────────────────────
  useEffect(() => {
    document.title = running
      ? `${fmt(remaining)} — ${MODE_LABELS[mode]} | Notebook`
      : 'Notebook'
  }, [running, remaining, mode])

  // ── ring progress ───────────────────────────────────────────────────────────
  const total      = customDurations[mode]
  const progress   = remaining / total                   // 1 → 0
  const dashOffset = CIRC * (1 - progress)

  // ── dots: completed work sessions in current long-break cycle ───────────────
  const dotsFilled = completedWork % 4

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto py-8 px-4">

      {/* ── mode tabs + gear icon (relative so settings panel can float below) ── */}
      <div className="relative flex items-center gap-2 w-full">
        <div className="flex gap-1 bg-card rounded-lg p-1 flex-1">
          {(['work', 'shortBreak', 'longBreak']).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={clsx(
                'flex-1 text-[11px] tracking-wide py-1.5 rounded-md transition-all duration-200',
                mode === m
                  ? 'bg-surface text-bright shadow-sm'
                  : 'text-dim hover:text-soft'
              )}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {/* Settings gear */}
        <button
          onClick={() => setShowSettings(s => !s)}
          aria-label="Timer settings"
          className={clsx(
            'p-1.5 rounded-md transition-colors shrink-0',
            showSettings ? 'text-accent bg-surface' : 'text-dim hover:text-soft'
          )}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        {/* ── settings panel — floats below the row, doesn't shift layout ── */}
        {showSettings && (
          <div className="absolute top-full left-0 right-0 mt-2 z-20 bg-card rounded-xl p-4 flex flex-col gap-3 border border-border shadow-2xl">
            <p className="text-[11px] text-dim tracking-widest uppercase">Duration (minutes)</p>
            {(['work', 'shortBreak', 'longBreak']).map(m => (
              <div key={m} className="flex items-center justify-between gap-3">
                <span className={clsx('text-xs', MODE_COLORS[m])}>{DURATION_LABELS[m]}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      const next = Math.max(1, draftMins[m] - 1)
                      setDraftMins(d => ({ ...d, [m]: next }))
                      setDuration(m, next)
                    }}
                    className="w-6 h-6 rounded flex items-center justify-center text-dim hover:text-soft hover:bg-surface transition-colors text-base leading-none"
                  >−</button>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={draftMins[m]}
                    onChange={e => {
                      const val = e.target.value === '' ? '' : Number(e.target.value)
                      setDraftMins(d => ({ ...d, [m]: val }))
                    }}
                    onBlur={e => {
                      const mins = Math.max(1, Math.min(180, Number(e.target.value) || 1))
                      setDraftMins(d => ({ ...d, [m]: mins }))
                      setDuration(m, mins)
                    }}
                    className="w-12 bg-surface text-center text-sm text-bright rounded-md py-0.5 border border-border focus:outline-none focus:border-accent tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => {
                      const next = Math.min(180, draftMins[m] + 1)
                      setDraftMins(d => ({ ...d, [m]: next }))
                      setDuration(m, next)
                    }}
                    className="w-6 h-6 rounded flex items-center justify-center text-dim hover:text-soft hover:bg-surface transition-colors text-base leading-none"
                  >+</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SVG ring clock ── */}
      <div className="relative">
        {/* glow pulse behind ring when running */}
        {running && (
          <div className={clsx(
            'absolute inset-0 rounded-full animate-pulse-ring',
            mode === 'work'       ? 'bg-accent/10' :
            mode === 'shortBreak' ? 'bg-green/10'  : 'bg-amber/10'
          )} />
        )}

        <svg width="200" height="200" className="-rotate-90">
          {/* track */}
          <circle
            cx={CX} cy={CX} r={R}
            fill="none"
            strokeWidth="5"
            className="stroke-muted"
          />
          {/* progress */}
          <circle
            cx={CX} cy={CX} r={R}
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
            className={clsx('transition-all duration-1000 ease-linear', MODE_RING[mode])}
          />
        </svg>

        {/* centre readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={clsx(
              'text-4xl font-semibold tabular-nums tracking-tight',
              running ? MODE_COLORS[mode] : 'text-bright'
            )}
          >
            {fmt(remaining)}
          </span>
          <span className={clsx('text-[11px] tracking-widest mt-1 uppercase', MODE_COLORS[mode])}>
            {MODE_LABELS[mode]}
          </span>
        </div>
      </div>

      {/* ── session dots ── */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={clsx(
              'w-2 h-2 rounded-full transition-colors duration-300',
              i < dotsFilled ? 'bg-accent' : 'bg-muted'
            )}
          />
        ))}
      </div>

      {/* ── subject picker ── */}
      <SubjectPicker
        onSubjectChange={id => useTimerStore.getState().setSubjectId(id)}
      />

      {/* ── controls ── */}
      <div className="flex items-center gap-4">
        {/* Reset */}
        <button
          onClick={reset}
          aria-label="Reset"
          className="p-2 rounded-full text-dim hover:text-soft transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
          </svg>
        </button>

        {/* Play / Pause — primary button */}
        <button
          onClick={running ? pause : start}
          aria-label={running ? 'Pause' : 'Start'}
          className={clsx(
            'w-14 h-14 rounded-full flex items-center justify-center',
            'transition-all duration-200 active:scale-95 shadow-lg',
            running
              ? 'bg-surface border border-border text-soft hover:text-bright hover:border-soft'
              : 'bg-accent text-white hover:bg-accent-dim'
          )}
        >
          {running ? (
            // Pause icon
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6"  y="4" width="4" height="16" rx="1"/>
              <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            // Play icon
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
          )}
        </button>

        {/* Skip */}
        <button
          onClick={() => useTimerStore.getState().skip()}
          aria-label="Skip"
          className="p-2 rounded-full text-dim hover:text-soft transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 4 15 12 5 20 5 4"/>
            <line x1="19" y1="5" x2="19" y2="19"/>
          </svg>
        </button>
      </div>

      {/* ── XP bar ── */}
      <div className="w-full mt-2">
        <XPBar flash={xpFlash} />
      </div>

      {/* ── session count ── */}
      <p className="text-[11px] text-dim tracking-wide">
        {completedWork} session{completedWork !== 1 ? 's' : ''} completed today
      </p>

      {/* ── toast ── */}
      {toast && (
        <div
          key={toast.key}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-card border border-border text-bright text-sm px-5 py-2.5 rounded-full shadow-xl animate-pop"
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
