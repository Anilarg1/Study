import { useState, useEffect, useRef } from 'react'
import useSubjectStore from '../store/useSubjectStore'
import useTagStore     from '../store/useTagStore'

const PRESETS = [25, 50, 90]

interface NewSessionModalProps {
  running:  boolean
  onStart:  (subjectId: string | null, durationMins: number, tagId: string | null) => void
  onCancel: () => void
}

export default function NewSessionModal({ running, onStart, onCancel }: NewSessionModalProps) {
  const subjects = useSubjectStore(s => s.subjects)
  const activeId = useSubjectStore(s => s.activeId)
  const tags     = useTagStore(s => s.tags)
  const addTag   = useTagStore(s => s.addTag)

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(activeId)
  const [selectedTagId,     setSelectedTagId]     = useState<string | null>(null)
  const [duration,          setDuration]          = useState(25)

  const [showAddTag,  setShowAddTag]  = useState(false)
  const [newTagName,  setNewTagName]  = useState('')
  const [tagAddError, setTagAddError] = useState<string | null>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)

  // Focus tag input when panel opens
  useEffect(() => {
    if (showAddTag) tagInputRef.current?.focus()
  }, [showAddTag])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  function adjust(delta: number) {
    setDuration(d => Math.max(1, Math.min(180, d + delta)))
  }

  async function handleAddTag() {
    const name = newTagName.trim()
    if (!name) return
    setTagAddError(null)
    const tag = await addTag(name)
    if (tag) {
      setSelectedTagId(tag.id)
      setNewTagName('')
      setShowAddTag(false)
    } else {
      setTagAddError('Could not save — check your connection.')
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 200,
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        animation: 'modal-fade 120ms ease',
      }}
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New session"
        style={{
          width: 380,
          background: 'var(--surface-2)',
          border: '1px solid var(--hairline-2)',
          borderRadius: 12,
          padding: '20px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset',
          animation: 'modal-panel-in 140ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >

        {/* ── header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            New session
          </span>
          <button
            onClick={onCancel}
            style={{
              width: 24, height: 24, borderRadius: 6,
              background: 'transparent', border: 'none',
              color: 'var(--text-mute)', cursor: 'pointer',
              fontSize: 18, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'inherit', transition: 'color 120ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-mute)')}
          >×</button>
        </div>

        {/* ── running warning ── */}
        {running && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'color-mix(in oklab, #f5a25a 10%, var(--surface-3))',
            border: '1px solid color-mix(in oklab, #f5a25a 28%, var(--hairline))',
            borderRadius: 7, padding: '7px 10px',
            marginBottom: 16, fontSize: 12, color: '#f5a25a',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10.3 3.3L1.6 18a2 2 0 0 0 1.7 3h17.4a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            A session is running — starting a new one will end it.
          </div>
        )}

        {/* ── subject ── */}
        <div style={{ marginBottom: 16 }}>
          <p style={{
            fontSize: 10.5, fontWeight: 500, color: 'var(--text-mute)',
            letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8,
          }}>
            Subject
          </p>
          {subjects.length === 0 ? (
            <span style={{ fontSize: 12, color: 'var(--text-mute)' }}>
              No subjects yet — add one from the timer.
            </span>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {subjects.map(s => (
                <button
                  key={s.id}
                  className={`chip${selectedSubjectId === s.id ? ' selected' : ''}`}
                  onClick={() => setSelectedSubjectId(prev => prev === s.id ? null : s.id)}
                >
                  <span className="chip-swatch" style={{ background: s.color }} />
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── tags ── */}
        <div style={{ marginBottom: 18 }}>
          <p style={{
            fontSize: 10.5, fontWeight: 500, color: 'var(--text-mute)',
            letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8,
          }}>
            Tag
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {tags.map(t => (
              <button
                key={t.id}
                className={`chip${selectedTagId === t.id ? ' selected' : ''}`}
                onClick={() => setSelectedTagId(prev => prev === t.id ? null : t.id)}
              >
                {t.name}
              </button>
            ))}

            {showAddTag ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', marginTop: tags.length > 0 ? 4 : 0 }}>
                <input
                  ref={tagInputRef}
                  type="text"
                  value={newTagName}
                  onChange={e => { setNewTagName(e.target.value); setTagAddError(null) }}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  handleAddTag()
                    if (e.key === 'Escape') { setShowAddTag(false); setNewTagName(''); setTagAddError(null) }
                  }}
                  placeholder="Tag name (e.g. revision)"
                  maxLength={30}
                  style={{
                    background: 'var(--surface-3)',
                    border: '1px solid var(--hairline-2)',
                    borderRadius: 6,
                    padding: '5px 8px',
                    fontSize: 12,
                    color: 'var(--text)',
                    outline: 'none',
                    fontFamily: 'inherit',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
                {tagAddError && (
                  <span style={{ fontSize: 11, color: '#f87171' }}>{tagAddError}</span>
                )}
              </div>
            ) : (
              <button
                className="chip chip-add"
                onClick={() => setShowAddTag(true)}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Add tag
              </button>
            )}
          </div>
        </div>

        {/* ── duration ── */}
        <div style={{ marginBottom: 22 }}>
          <p style={{
            fontSize: 10.5, fontWeight: 500, color: 'var(--text-mute)',
            letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8,
          }}>
            Duration
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

            {/* preset pills */}
            {PRESETS.map(p => (
              <button
                key={p}
                onClick={() => setDuration(p)}
                style={{
                  height: 26, padding: '0 10px',
                  borderRadius: 999, fontSize: 12, cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'all 140ms',
                  background: duration === p
                    ? 'color-mix(in oklab, var(--accent) 14%, var(--surface))'
                    : 'var(--surface)',
                  border: '1px solid',
                  borderColor: duration === p
                    ? 'color-mix(in oklab, var(--accent) 38%, var(--hairline))'
                    : 'var(--hairline)',
                  color: duration === p ? 'var(--text)' : 'var(--text-dim)',
                }}
              >
                {p} min
              </button>
            ))}

            <div style={{ flex: 1 }} />

            {/* stepper */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={() => adjust(-5)}
                style={{
                  width: 26, height: 26, borderRadius: 6,
                  background: 'var(--surface-3)', border: '1px solid var(--hairline)',
                  color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'inherit',
                }}
              >−</button>
              <input
                type="number" min="1" max="180"
                value={duration}
                onChange={e => {
                  const v = Number(e.target.value)
                  if (!isNaN(v) && v > 0) setDuration(v)
                }}
                onBlur={e =>
                  setDuration(Math.max(1, Math.min(180, Number(e.target.value) || 1)))
                }
                style={{
                  width: 44, textAlign: 'center', fontSize: 12,
                  background: 'var(--surface-3)', color: 'var(--text)',
                  border: '1px solid var(--hairline-2)', borderRadius: 6,
                  padding: '2px 0', outline: 'none',
                  fontFamily: 'Geist Mono, monospace',
                  MozAppearance: 'textfield',
                  appearance: 'textfield',
                } as React.CSSProperties}
              />
              <span style={{ fontSize: 11, color: 'var(--text-mute)' }}>min</span>
              <button
                onClick={() => adjust(5)}
                style={{
                  width: 26, height: 26, borderRadius: 6,
                  background: 'var(--surface-3)', border: '1px solid var(--hairline)',
                  color: 'var(--text-dim)', cursor: 'pointer', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'inherit',
                }}
              >+</button>
            </div>

          </div>
        </div>

        {/* ── actions ── */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              height: 32, padding: '0 14px',
              background: 'var(--surface-3)', color: 'var(--text-dim)',
              border: '1px solid var(--hairline)', borderRadius: 7,
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 140ms, color 140ms',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onStart(selectedSubjectId, duration, selectedTagId)}
            style={{
              height: 32, padding: '0 16px',
              background: 'var(--accent)', color: '#fff',
              border: '1px solid transparent', borderRadius: 7,
              fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 7,
              boxShadow: '0 1px 0 rgba(255,255,255,0.15) inset, 0 4px 12px -4px var(--accent-glow)',
              transition: 'opacity 140ms',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
            Start session
          </button>
        </div>

      </div>
    </div>
  )
}
