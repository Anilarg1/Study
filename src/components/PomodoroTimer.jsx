import { useEffect, useRef, useState, useCallback } from 'react'
import useTimerStore, { DURATIONS } from '../store/useTimerStore'
import useXPStore from '../store/useXPStore'
import XPBar from './XPBar'
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

export default function PomodoroTimer() {
  const {
    mode, remaining, running, completedWork, subject,
    start, pause, reset, setMode, setSubject, tick,
  } = useTimerStore()

  const awardXP    = useXPStore(s => s.awardXP)

  // Flash state for XP bar + level-up toast
  const [xpFlash,  setXpFlash]  = useState(false)
  const [toast,    setToast]     = useState(null)   // { msg, key }
  const tickRef                  = useRef(null)

  // ── ticker ──────────────────────────────────────────────────────────────────
  const handleTick = useCallback(() => {
    const finished = tick()
    if (finished) {
      const result = awardXP(mode)       // mode is the one that just ended
      setXpFlash(true)
      setTimeout(() => setXpFlash(false), 800)

      const msg = result.leveledUp
        ? `🎉 Level up! You're now Level ${result.newLevel}`
        : `+${result.xp} XP`

      setToast({ msg, key: Date.now() })
      setTimeout(() => setToast(null), 3000)
    }
  }, [tick, awardXP, mode])

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
  const total     = DURATIONS[mode]
  const progress  = remaining / total                    // 1 → 0
  const dashOffset = CIRC * (1 - progress)

  // ── dots: completed work sessions in current long-break cycle ───────────────
  const dotsFilled = completedWork % 4

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm mx-auto py-8 px-4">

      {/* ── mode tabs ── */}
      <div className="flex gap-1 bg-card rounded-lg p-1 w-full">
        {(['work', 'shortBreak', 'longBreak'] ).map(m => (
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

      {/* ── subject label ── */}
      <input
        type="text"
        value={subject}
        onChange={e => setSubject(e.target.value)}
        placeholder="What are you studying?"
        maxLength={60}
        className={clsx(
          'w-full bg-transparent border-b border-border text-center text-sm text-soft',
          'placeholder:text-muted focus:outline-none focus:border-accent transition-colors py-1'
        )}
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
