import { useEffect, useRef, useState, useCallback } from 'react'
import useTimerStore    from '../store/useTimerStore'
import useXPStore       from '../store/useXPStore'
import useSubjectStore  from '../store/useSubjectStore'
import useTagStore      from '../store/useTagStore'
import useSettingsStore from '../store/useSettingsStore'
import { playChime }    from '../lib/chime'
import type { TimerMode, TimerDurations, Subject } from '../types'

// ── constants ─────────────────────────────────────────────────────────────

const R    = 92
const CIRC = 2 * Math.PI * R

const MODE_LABELS: Record<TimerMode, string> = { work: 'Focus', shortBreak: 'Short break', longBreak: 'Long break' }
const MODE_KEYS:   Record<TimerMode, string> = { work: '1', shortBreak: '2', longBreak: '3' }

function fmt(seconds: number): [string, string] {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return [m, s]
}

type PipState = 'done' | 'now' | 'pending'

function getPips(completedWork: number): PipState[] {
  const pos = completedWork % 4
  return Array.from({ length: 4 }, (_, i) => {
    if (i < pos)   return 'done'
    if (i === pos) return 'now'
    return 'pending'
  })
}

function nextLabel(completedWork: number): string {
  const pos = completedWork % 4
  if (pos < 3) return 'short break next'
  return 'long break next'
}

// ── sub-components ────────────────────────────────────────────────────────

interface AddSubjectPanelProps {
  onAdd:    (name: string, color: string) => Promise<Subject | null>
  onCancel: () => void
}

function AddSubjectPanel({ onAdd, onCancel }: AddSubjectPanelProps) {
  const [name, setName]   = useState('')
  const [color, setColor] = useState('#8b85ff')
  const [err, setErr]     = useState<string | null>(null)
  const inputRef          = useRef<HTMLInputElement>(null)

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

const DURATION_LABELS: Record<TimerMode, string> = { work: 'Focus', shortBreak: 'Short break', longBreak: 'Long break' }

const SLIDER_CONFIG: Record<TimerMode, { min: number; max: number; step: number; color: string }> = {
  work:       { min: 5,  max: 120, step: 5,  color: 'var(--focus)' },
  shortBreak: { min: 1,  max: 30,  step: 1,  color: 'var(--short)' },
  longBreak:  { min: 5,  max: 60,  step: 5,  color: 'var(--long)'  },
}

const PRESETS = [
  { label: '25 / 5',  work: 25, shortBreak: 5,  longBreak: 15 },
  { label: '50 / 10', work: 50, shortBreak: 10, longBreak: 15 },
  { label: '40 / 20', work: 40, shortBreak: 20, longBreak: 15 },
]

interface SettingsPanelProps {
  customDurations: TimerDurations
  setDuration:     (mode: TimerMode, minutes: number) => void
}

function SettingsPanel({ customDurations, setDuration }: SettingsPanelProps) {
  const [drafts, setDrafts] = useState<Record<TimerMode, number>>({
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

  function applyPreset(preset: typeof PRESETS[number]) {
    setDrafts({ work: preset.work, shortBreak: preset.shortBreak, longBreak: preset.longBreak })
    setDuration('work',       preset.work)
    setDuration('shortBreak', preset.shortBreak)
    setDuration('longBreak',  preset.longBreak)
  }

  function handleSlider(m: TimerMode, val: string) {
    const v = Number(val)
    setDrafts(d => ({ ...d, [m]: v }))
    setDuration(m, v)
  }

  function fillPct(m: TimerMode): string {
    const { min, max } = SLIDER_CONFIG[m]
    return ((drafts[m] - min) / (max - min) * 100).toFixed(2) + '%'
  }

  const activePreset = PRESETS.find(p =>
    p.work === drafts.work && p.shortBreak === drafts.shortBreak && p.longBreak === drafts.longBreak
  )?.label ?? null

  return (
    <div className="settings-panel" style={{ marginTop: 6 }}>

      <p className="sp-label">Preset</p>
      <div className="sp-presets">
        {PRESETS.map(p => (
          <button
            key={p.label}
            className={`sp-preset-btn${activePreset === p.label ? ' active' : ''}`}
            onClick={() => applyPreset(p)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <p className="sp-label" style={{ marginTop: 14 }}>Duration (min)</p>
      {(['work', 'shortBreak', 'longBreak'] as TimerMode[]).map(m => {
        const { min, max, step, color } = SLIDER_CONFIG[m]
        return (
          <div key={m} className="sp-slider-row">
            <div className="sp-slider-meta">
              <span className="sp-slider-label" style={{ color }}>{DURATION_LABELS[m]}</span>
              <span className="sp-slider-val">
                {drafts[m]}<span className="sp-slider-unit">m</span>
              </span>
            </div>
            <input
              type="range"
              className="pomo-slider"
              min={min} max={max} step={step}
              value={drafts[m]}
              style={{ '--fill-color': color, '--fill-pct': fillPct(m) } as React.CSSProperties}
              onChange={e => handleSlider(m, e.target.value)}
            />
          </div>
        )
      })}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────

export default function PomodoroTimer() {
  const {
    mode, remaining, running, completedWork, subjectId, tagId, customDurations,
    start, pause, reset, setMode, setDuration, tick, setSubjectId, setTagId, skip,
  } = useTimerStore()

  const awardXP      = useXPStore(s => s.awardXP)
  const soundEnabled = useSettingsStore(s => s.soundEnabled)

  const subjects      = useSubjectStore(s => s.subjects)
  const activeId      = useSubjectStore(s => s.activeId)
  const setActiveId   = useSubjectStore(s => s.setActiveId)
  const addSubject    = useSubjectStore(s => s.addSubject)
  const tags    = useTagStore(s => s.tags)
  const addTag  = useTagStore(s => s.addTag)
  const activeSubject = subjects.find(s => s.id === activeId) ?? null
  const activeTag = tags.find(t => t.id === tagId) ?? null

  const [toast,        setToast]       = useState<{ msg: string; key: number } | null>(null)
  const [showSettings, setSettings]    = useState(false)
  const [showAddSubj,  setShowAddSubj] = useState(false)
  const [showAddTag,  setShowAddTag]  = useState(false)
  const [newTagName,  setNewTagName]  = useState('')
  const [tagAddError, setTagAddError] = useState<string | null>(null)
  const tickRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const chipsRef     = useRef<HTMLDivElement>(null)
  const settingsRef  = useRef<HTMLDivElement>(null)
  const tagPickerRef = useRef<HTMLDivElement>(null)

  const [showTagPicker, setShowTagPicker] = useState(false)

  // ── close settings on outside click ──────────────────────────────────────
  useEffect(() => {
    if (!showSettings) return
    function onOutside(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettings(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [showSettings])

  // ── close tag picker on outside click ────────────────────────────────────
  useEffect(() => {
    if (!showTagPicker) return
    function onOutside(e: MouseEvent) {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node)) {
        setShowTagPicker(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [showTagPicker])

  // ── ticker ────────────────────────────────────────────────────────────────
  const handleTick = useCallback(() => {
    const finished = tick()
    if (finished) {
      const result = awardXP(mode, subjectId, customDurations[mode], tagId)
      if (soundEnabled) playChime(mode)
      const msg = result.leveledUp
        ? `🎉 Level up! You're now Level ${result.newLevel}`
        : `+${result.xp} XP`
      setToast({ msg, key: Date.now() })
      setTimeout(() => setToast(null), 3000)
    }
  }, [tick, awardXP, mode, subjectId, tagId, customDurations, soundEnabled])

  useEffect(() => {
    if (running) {
      tickRef.current = setInterval(handleTick, 1000)
    } else {
      if (tickRef.current !== null) clearInterval(tickRef.current)
    }
    return () => { if (tickRef.current !== null) clearInterval(tickRef.current) }
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
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).matches('input, textarea')) return
      if (e.code === 'Space') {
        e.preventDefault()
        running ? pause() : start()
      } else if (e.key.toLowerCase() === 'r') {
        reset()
      } else if (e.key === 'ArrowRight') {
        skip()
      } else if (e.key === '1') setMode('work')
      else if (e.key === '2') setMode('shortBreak')
      else if (e.key === '3') setMode('longBreak')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running, start, pause, reset, setMode, skip])

  // ── ring ──────────────────────────────────────────────────────────────────
  const total      = customDurations[mode]
  const progress   = remaining / total
  const dashOffset = CIRC * (1 - (1 - progress))

  // ── pips ──────────────────────────────────────────────────────────────────
  const pips     = getPips(completedWork)
  const pipsDone = pips.filter(p => p === 'done').length
  const pipNow   = pips.indexOf('now')

  // suppress unused warning
  void pipNow
  void chipsRef

  // ── subject chip handlers ────────────────────────────────────────────────
  function selectSubject(id: string | null) {
    setActiveId(id)
    setSubjectId(id)
  }

  async function handleAddSubject(name: string, color: string): Promise<Subject | null> {
    const subj = await addSubject(name, color)
    if (subj) {
      selectSubject(subj.id)
      setShowAddSubj(false)
    }
    return subj
  }

  async function handleAddTag() {
    const name = newTagName.trim()
    if (!name) return
    setTagAddError(null)
    const tag = await addTag(name)
    if (tag) {
      setTagId(tag.id)
      setNewTagName('')
      setShowAddTag(false)
      setShowTagPicker(false)
    } else {
      setTagAddError('Could not save — check your connection.')
    }
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
          <button className="filter-pill" onClick={() => { setActiveId(null); setSubjectId(null) }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: activeSubject.color, display: 'inline-block', flexShrink: 0 }} />
            {activeSubject.name}
            <span style={{ color: 'var(--text-faint)', marginLeft: 2 }}>×</span>
          </button>
        )}
          <div style={{ position: 'relative' }} ref={tagPickerRef}>
            <button
              className="filter-pill"
              style={activeTag
                ? { borderStyle: 'solid', color: 'var(--text)' }
                : { borderStyle: 'dashed', color: 'var(--text-mute)' }
              }
              onClick={() => setShowTagPicker(p => !p)}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                <line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
              {activeTag ? activeTag.name : 'Tag'}
              {activeTag && (
                <span
                  style={{ color: 'var(--text-faint)', marginLeft: 2 }}
                  onClick={e => { e.stopPropagation(); setTagId(null) }}
                >×</span>
              )}
            </button>

            {showTagPicker && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                background: 'var(--surface)',
                border: '1px solid var(--hairline)',
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                minWidth: 180,
                zIndex: 50,
                overflow: 'hidden',
              }}>
                {tags.length === 0 && !showAddTag && (
                  <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-faint)', fontFamily: 'inherit' }}>
                    No tags yet
                  </div>
                )}
                {tags.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setTagId(tagId === t.id ? null : t.id); setShowTagPicker(false) }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '7px 12px',
                      fontSize: 12,
                      color: tagId === t.id ? 'var(--text)' : 'var(--text-dim)',
                      background: tagId === t.id ? 'var(--surface-3)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                    }}
                  >
                    {t.name}
                  </button>
                ))}

                {/* Inline add tag */}
                {showAddTag ? (
                  <div style={{ padding: '8px 12px', borderTop: tags.length > 0 ? '1px solid var(--hairline)' : 'none' }}>
                    <input
                      autoFocus
                      type="text"
                      value={newTagName}
                      onChange={e => { setNewTagName(e.target.value); setTagAddError(null) }}
                      onKeyDown={e => {
                        if (e.key === 'Enter')  handleAddTag()
                        if (e.key === 'Escape') { setShowAddTag(false); setNewTagName(''); setTagAddError(null) }
                      }}
                      placeholder="Tag name"
                      maxLength={30}
                      style={{
                        width: '100%',
                        background: 'var(--surface-3)',
                        border: '1px solid var(--hairline-2)',
                        borderRadius: 5,
                        padding: '4px 8px',
                        fontSize: 12,
                        color: 'var(--text)',
                        outline: 'none',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                      }}
                    />
                    {tagAddError && (
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#f87171' }}>{tagAddError}</p>
                    )}
                  </div>
                ) : (
                  <div style={{ borderTop: tags.length > 0 ? '1px solid var(--hairline)' : 'none' }}>
                    <button
                      onClick={() => setShowAddTag(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        width: '100%',
                        padding: '7px 12px',
                        fontSize: 12,
                        color: 'var(--text-mute)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M12 5v14M5 12h14"/>
                      </svg>
                      Add tag
                    </button>
                  </div>
                )}

                {tagId && (
                  <>
                    <div style={{ borderTop: '1px solid var(--hairline)', margin: '2px 0' }} />
                    <button
                      onClick={() => { setTagId(null); setShowTagPicker(false) }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        padding: '7px 12px',
                        fontSize: 12,
                        color: 'var(--text-mute)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                      }}
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
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
        <div className="mode-tabs" style={{ position: 'relative' }} ref={settingsRef}>
          {(['work', 'shortBreak', 'longBreak'] as TimerMode[]).map(m => (
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
            <div className="timer-context">
              <span className={`ctx-dot${running ? ' pulsing' : ''}`} />
              <span>{MODE_LABELS[mode]}</span>
              <span className="ctx-session">
                Session {Math.min(pipsDone + 1, 4)} / 4
              </span>
            </div>

            <div className="time-display">
              {mm}<span className="time-sep">:</span>{ss}
            </div>

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
          <div className="ctrl-wrap">
            <button className="ctrl" onClick={reset} aria-label="Reset">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/>
              </svg>
            </button>
            <span className="ctrl-hint">RESET · R</span>
          </div>

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

          <div className="ctrl-wrap">
            <button className="ctrl" onClick={skip} aria-label="Skip">
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
