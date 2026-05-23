import { useEffect, useRef, useState, useCallback } from 'react'
import useTimerStore   from '../store/useTimerStore'
import useXPStore      from '../store/useXPStore'
import useSubjectStore from '../store/useSubjectStore'

// ── constants ─────────────────────────────────────────────────────────────

const R    = 92
const CIRC = 2 * Math.PI * R   // ≈ 578.05

const MODE_LABELS = { work: 'Focus', shortBreak: 'Short break', longBreak: 'Long break' }
const MODE_KEYS   = { work: '1', shortBreak: '2', longBreak: '3' }

// Pomodoro skip order
const SKIP_ORDER = ['work', 'shortBreak', 'work', 'shortBreak', 'work', 'shortBreak', 'work', 'longBreak']

function fmt(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return [m, s]
}

// Pip state for the current pomodoro cycle (0–3 completed work sessions)
function getPips(completedWork) {
  const pos = completedWork % 4   // 0–3 done in this cycle
  return Array.from({ length: 4 }, (_, i) => {
    if (i < pos)  return 'done'
    if (i === pos) return 'now'
    return 'pending'
  })
}

function nextLabel(completedWork) {
  const pos = completedWork % 4
  if (pos < 3) return 'short break next'
  return 'long break next'
}

// ── sub-components ────────────────────────────────────────────────────────

function AddSubjectPanel({ onAdd, onCancel }) {
  const [name, setName]   = useState('')
  const [color, setColor] = useState('#8b85ff')
  const [err, setErr]     = useState(null)
  const inputRef          = useRef(null)

  const COLORS = ['#8b85ff','#4cb782','#5e9eea','#f5a25a','#c97ad8','#f87171','#38bdf8','#34d399']

  useEffect(() => { inputRef.current?.focus() }, [])

  async function submit() {
    if (!name.trim()) return
    const result = await onAdd(name.trim(), color)
    if (!result) setErr('Could not save — check connection and try again.')
  }

  return (
    <div className="add-subj-panel" style={{ position: 'absolute', top: '100%', marginTop: 6, zIndex: 50 }}>
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={e => { setName(e.target.value); setErr(null) }}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel() }}
        placeholder="Subject name"
        maxLength={40}
        style={{
          width: '100%',
          background: 'var(--surface-3)',
          border: '1px solid var(--hairline-2)',
          borderRadius: 6,
          padding: '5px 8px',
          fontSize: 13,
          color: 'var(--text)',
          outline: 'none',
          fontFamily: 'inherit',
          marginBottom: 10,
        }}
      />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {COLORS.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: 20, height: 20,
              borderRadius: '50%',
              background: c,
              border: color === c ? '2px solid var(--text)' : '2px solid transparent',
              cursor: 'pointer',
              outline: color === c ? '2px solid var(--surface-3)' : 'none',
              outlineOffset: 1,
            }}
          />
        ))}
      </div>
      {err && <p style={{ fontSize: 11, color: '#f87171', marginBottom: 8 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={submit}
          disabled={!name.trim()}
          style={{
            flex: 1, padding: '5px 0', borderRadius: 6,
            background: 'var(--accent)', color: '#fff',
            fontSize: 12, fontWeight: 500,
            border: 'none', cursor: 'pointer',
            opacity: name.trim() ? 1 : 0.4,
            fontFamily: 'inherit',
          }}
        >Add</button>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: '5px 0', borderRadius: 6,
            background: 'var(--surface-3)', color: 'var(--text-dim)',
            fontSize: 12, border: '1px solid var(--hairline)', cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >Cancel</button>
      </div>
    </div>
  )
}

// ── settings panel ────────────────────────────────────────────────────────

const DURATION_LABELS = { work: 'Focus', shortBreak: 'Short break', longBreak: 'Long break' }
const DURATION_COLORS = { work: 'var(--focus)', shortBreak: 'var(--short)', longBreak: 'var(--long)' }

function SettingsPanel({ customDurations, setDuration }) {
  const [drafts, setDrafts] = useState({
    work:       customDurations.work       / 60,
    shortBreak: customDurations.shortBreak / 60,
    longBreak:  customDurations.longBreak  / 60,
  })

  useEffect(() => {
    setDrafts({
      work:       customDurations.work       / 60,
      shortBreak: customDurations.shortBreak / 60,
      longBreak:  customDurations.longBreak  / 60,
    })
  }, [customDurations.work, customDurations.shortBreak, customDurations.longBreak])

  function adjust(m, delta) {
    const next = Math.max(1, Math.min(180, (drafts[m] || 1) + delta))
    setDrafts(d => ({ ...d, [m]: next }))
    setDuration(m, next)
  }

  return (
    <div className="settings-panel" style={{ marginTop: 6 }}>
      <p style={{ fontSize: '10.5px', color: 'var(--text-mute)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12, margin: '0 0 12px' }}>
        Duration (minutes)
      </p>
      {(['work', 'shortBreak', 'longBreak']).map(m => (
        <div key={m} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: DURATION_COLORS[m] }}>{DURATION_LABELS[m]}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => adjust(m, -1)}
              style={{ width: 24, height: 24, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', background: 'var(--surface-3)', border: '1px solid var(--hairline)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}
            >−</button>
            <input
              type="number" min="1" max="180"
              value={drafts[m]}
              onChange={e => setDrafts(d => ({ ...d, [m]: e.target.value === '' ? '' : Number(e.target.value) }))}
              onBlur={e => {
                const v = Math.max(1, Math.min(180, Number(e.target.value) || 1))
                setDrafts(d => ({ ...d, [m]: v }))
                setDuration(m, v)
              }}
              style={{
                width: 44, textAlign: 'center', fontSize: 13,
                background: 'var(--surface-3)', color: 'var(--text)',
                border: '1px solid var(--hairline-2)', borderRadius: 5,
                padding: '2px 0', outline: 'none', fontFamily: 'Geist Mono, monospace',
                appearance: 'textfield',
              }}
            />
            <button
              onClick={() => adjust(m, 1)}
              style={{ width: 24, height: 24, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', background: 'var(--surface-3)', border: '1px solid var(--hairline)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}
            >+</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────

export default function PomodoroTimer() {
  const {
    mode, remaining, running, completedWork, subjectId, customDurations,
    start, pause, reset, setMode, setDuration, tick, setSubjectId,
  } = useTimerStore()

  const awardXP = useXPStore(s => s.awardXP)

  const subjects   = useSubjectStore(s => s.subjects)
  const activeId   = useSubjectStore(s => s.activeId)
  const setActiveId = useSubjectStore(s => s.setActiveId)
  const addSubject = useSubjectStore(s => s.addSubject)
  const activeSubject = subjects.find(s => s.id === activeId) ?? null

  const [toast,       setToast]       = useState(null)
  const [showSettings, setSettings]   = useState(false)
  const [showAddSubj,  setShowAddSubj] = useState(false)
  const tickRef = useRef(null)
  const chipsRef = useRef(null)

  // ── ticker ────────────────────────────────────────────────────────────────
  const handleTick = useCallback(() => {
    const finished = tick()
    if (finished) {
      const result = awardXP(mode, subjectId)
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

  // ── document title ────────────────────────────────────────────────────────
  const [mm, ss] = fmt(remaining)
  useEffect(() => {
    document.title = running
      ? `${mm}:${ss} — ${MODE_LABELS[mode]} | Notebook`
      : 'Notebook'
  }, [running, mm, ss, mode])

  // ── keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.target.matches('input, textarea')) return
      if (e.code === 'Space') {
        e.preventDefault()
        running ? pause() : start()
      } else if (e.key.toLowerCase() === 'r') {
        reset()
      } else if (e.key === 'ArrowRight') {
        const i = SKIP_ORDER.indexOf(mode)
        setMode(SKIP_ORDER[(i + 1) % SKIP_ORDER.length])
      } else if (e.key === '1') setMode('work')
      else if (e.key === '2') setMode('shortBreak')
      else if (e.key === '3') setMode('longBreak')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running, mode, start, pause, reset, setMode])

  // ── ring ──────────────────────────────────────────────────────────────────
  const total      = customDurations[mode]
  const progress   = remaining / total
  const dashOffset = CIRC * (1 - (1 - progress))   // fills as time passes

  // ── pips ──────────────────────────────────────────────────────────────────
  const pips    = getPips(completedWork)
  const pipsDone = pips.filter(p => p === 'done').length
  const pipNow   = pips.indexOf('now')

  // ── subject chip handlers ────────────────────────────────────────────────
  function selectSubject(id) {
    setActiveId(id)
    setSubjectId(id)
  }

  async function handleAddSubject(name, color) {
    const subj = await addSubject(name, color)
    if (subj) {
      selectSubject(subj.id)
      setShowAddSubj(false)
    }
    return subj
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <main className="v2-main">

      {/* ── filter bar ── */}
      <div className="filter-bar">
        <button className="filter-pill">
          <span className="pill-dot" />
          Focus session
        </button>
        {activeSubject && (
          <button className="filter-pill">
            <span style={{ width: 8, height: 8, borderRadius: 2, background: activeSubject.color, display: 'inline-block', flexShrink: 0 }} />
            {activeSubject.name}
            <span style={{ color: 'var(--text-faint)', marginLeft: 2 }}>×</span>
          </button>
        )}
        <button className="filter-pill" style={{ borderStyle: 'dashed', color: 'var(--text-mute)' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Tag
        </button>
        <div style={{ flex: 1 }} />
        <div className="view-toggle">
          <button className="view-btn active" title="Timer view">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
            </svg>
          </button>
          <button className="view-btn" title="List view">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── timer stage ── */}
      <div className="timer-stage">

        {/* mode tabs */}
        <div className="mode-tabs" style={{ position: 'relative' }}>
          {(['work', 'shortBreak', 'longBreak']).map(m => (
            <button
              key={m}
              className={`mode-tab${mode === m ? ' active' : ''}`}
              onClick={() => setMode(m)}
            >
              {MODE_LABELS[m]}
              <span className="kbd-mini">{MODE_KEYS[m]}</span>
            </button>
          ))}
          <button
            className="gear-btn"
            title="Timer settings"
            onClick={() => { setSettings(s => !s); setShowAddSubj(false) }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>
            </svg>
          </button>

          {showSettings && (
            <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
              <SettingsPanel customDurations={customDurations} setDuration={setDuration} />
            </div>
          )}
        </div>

        {/* timer hero */}
        <div className="timer-wrap">
          <div className={`timer-glow${running ? ' running' : ''}`} />

          <svg className="timer-ring" viewBox="0 0 200 200" aria-hidden="true">
            <circle className="ring-track" cx="100" cy="100" r={R} />
            <circle
              className="ring-progress"
              cx="100" cy="100" r={R}
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
            />
          </svg>

          <div className="timer-content">
            {/* context badge */}
            <div className="timer-context">
              <span className={`ctx-dot${running ? ' pulsing' : ''}`} />
              <span>{MODE_LABELS[mode]}</span>
              <span className="ctx-session">
                Session {Math.min(pipsDone + 1, 4)} / 4
              </span>
            </div>

            {/* time */}
            <div className="time-display">
              {mm}<span className="time-sep">:</span>{ss}
            </div>

            {/* subtitle */}
            <div className="timer-subtitle">
              {activeSubject
                ? <><b>{activeSubject.name}</b><span className="sub-sep">·</span><span style={{ color: 'var(--text-dim)' }}>Focus session</span></>
                : mode === 'work'
                  ? <span style={{ color: 'var(--text-mute)' }}>Select a subject below</span>
                  : <span style={{ color: 'var(--text-dim)' }}>{mode === 'shortBreak' ? 'Stretch, sip water, breathe' : 'Stand up, walk around, reset'}</span>
              }
            </div>
          </div>
        </div>

        {/* pips */}
        <div className="pips-row" aria-label="Pomodoro session progress">
          {pips.map((state, i) => (
            <div key={i} className={`pip${state === 'done' ? ' done' : state === 'now' ? ' now' : ''}`} title={`Session ${i + 1}`} />
          ))}
          <span className="pip-label">
            <b>{pipsDone + 1} / 4</b> · {nextLabel(completedWork)}
          </span>
        </div>

        {/* subject chips */}
        <div className="chips-row" ref={chipsRef} style={{ position: 'relative' }}>
          {subjects.map(s => (
            <button
              key={s.id}
              className={`chip${activeId === s.id ? ' selected' : ''}`}
              onClick={() => selectSubject(s.id)}
            >
              <span className="chip-swatch" style={{ background: s.color }} />
              {s.name}
            </button>
          ))}
          <div style={{ position: 'relative' }}>
            <button
              className="chip chip-add"
              onClick={() => { setShowAddSubj(v => !v); setSettings(false) }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Subject
            </button>
            {showAddSubj && (
              <AddSubjectPanel
                onAdd={handleAddSubject}
                onCancel={() => setShowAddSubj(false)}
              />
            )}
          </div>
        </div>

        {/* controls */}
        <div className="controls-row">
          {/* reset */}
          <div className="ctrl-wrap">
            <button className="ctrl" onClick={reset} aria-label="Reset">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/>
              </svg>
            </button>
            <span className="ctrl-hint">RESET · R</span>
          </div>

          {/* play / pause */}
          <div className="ctrl-wrap">
            <button
              className="ctrl primary"
              onClick={running ? pause : start}
              aria-label={running ? 'Pause' : 'Start'}
            >
              {running ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 5h4v14H7zM13 5h4v14h-4z"/>
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>
            <span className="ctrl-hint">{running ? 'PAUSE · SPACE' : 'PLAY · SPACE'}</span>
          </div>

          {/* skip */}
          <div className="ctrl-wrap">
            <button
              className="ctrl"
              onClick={() => {
                const i = SKIP_ORDER.indexOf(mode)
                setMode(SKIP_ORDER[(i + 1) % SKIP_ORDER.length])
              }}
              aria-label="Skip"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 4l10 8-10 8z"/><path d="M19 5v14"/>
              </svg>
            </button>
            <span className="ctrl-hint">SKIP · →</span>
          </div>
        </div>

        {/* keyboard hint bar */}
        <div className="kbd-hint-bar">
          <span><span className="kbd-badge">Space</span> pause</span>
          <span><span className="kbd-badge">R</span> reset</span>
          <span><span className="kbd-badge">→</span> skip</span>
          <span>
            <span className="kbd-badge">1</span>
            <span className="kbd-badge">2</span>
            <span className="kbd-badge">3</span>
            {' '}mode
          </span>
        </div>

      </div>

      {/* ── toast ── */}
      {toast && (
        <div key={toast.key} className="v2-toast">{toast.msg}</div>
      )}
    </main>
  )
}
