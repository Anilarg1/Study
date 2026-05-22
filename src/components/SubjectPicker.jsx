import { useState, useRef, useEffect } from 'react'
import useSubjectStore from '../store/useSubjectStore'
import clsx from 'clsx'

// ─── Color palette (matches theme tokens) ────────────────────────────────────
export const SUBJECT_COLORS = [
  '#7c6af0', // accent purple
  '#4ade80', // green
  '#fbbf24', // amber
  '#f87171', // red
  '#38bdf8', // sky
  '#fb7185', // rose
  '#a78bfa', // violet
  '#34d399', // emerald
]

// ─── component ───────────────────────────────────────────────────────────────

export default function SubjectPicker({ onSubjectChange }) {
  const { subjects, activeId, setActiveId, addSubject, deleteSubject } =
    useSubjectStore()

  const [open,     setOpen]     = useState(false)
  const [adding,   setAdding]   = useState(false)
  const [newName,  setNewName]  = useState('')
  const [newColor, setNewColor] = useState(SUBJECT_COLORS[0])

  const dropdownRef = useRef(null)
  const nameRef     = useRef(null)

  const activeSubject = subjects.find(s => s.id === activeId) ?? null

  // ── Close on outside click ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    function handleMouseDown(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
        setAdding(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open])

  // ── Focus input when adding panel opens ────────────────────────────────────
  useEffect(() => {
    if (adding) nameRef.current?.focus()
  }, [adding])

  // ── Notify parent when active subject changes ───────────────────────────────
  useEffect(() => {
    onSubjectChange?.(activeId)
  }, [activeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ────────────────────────────────────────────────────────────────
  function selectSubject(id) {
    setActiveId(id)
    setOpen(false)
    setAdding(false)
  }

  async function handleAdd() {
    if (!newName.trim()) return
    const subject = await addSubject(newName.trim(), newColor)
    if (subject) {
      setActiveId(subject.id)
      setNewName('')
      setNewColor(SUBJECT_COLORS[0])
      setAdding(false)
      setOpen(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter')  handleAdd()
    if (e.key === 'Escape') { setAdding(false); setNewName('') }
  }

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full" ref={dropdownRef}>

      {/* ── Trigger button ── */}
      <button
        onClick={() => { setOpen(o => !o); setAdding(false) }}
        className={clsx(
          'w-full flex items-center gap-2 py-1.5 px-3 rounded-lg border text-sm transition-colors',
          open
            ? 'border-accent bg-surface text-bright'
            : 'border-border bg-transparent text-soft hover:border-soft'
        )}
      >
        {activeSubject ? (
          <>
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: activeSubject.color }}
            />
            <span className="flex-1 text-left truncate">{activeSubject.name}</span>
          </>
        ) : (
          <span className="flex-1 text-left text-muted">What are you studying?</span>
        )}
        <svg
          className={clsx('w-3 h-3 text-dim shrink-0 transition-transform duration-150', open && 'rotate-180')}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-2xl overflow-hidden">

          {/* None */}
          <button
            onClick={() => selectSubject(null)}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
              activeId === null
                ? 'text-bright bg-surface'
                : 'text-dim hover:text-soft hover:bg-surface'
            )}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-muted shrink-0" />
            <span>None</span>
          </button>

          {/* Subject list */}
          {subjects.map(subject => (
            <div key={subject.id} className="group flex items-center">
              <button
                onClick={() => selectSubject(subject.id)}
                className={clsx(
                  'flex-1 flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                  activeId === subject.id
                    ? 'text-bright bg-surface'
                    : 'text-soft hover:text-bright hover:bg-surface'
                )}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: subject.color }}
                />
                <span className="flex-1 text-left truncate">{subject.name}</span>
              </button>

              {/* Delete button (visible on hover) */}
              <button
                onClick={e => { e.stopPropagation(); deleteSubject(subject.id) }}
                aria-label={`Delete ${subject.name}`}
                className="opacity-0 group-hover:opacity-100 pr-3 text-dim hover:text-red transition-all"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}

          {/* Divider */}
          <div className="border-t border-border mx-2 my-0.5" />

          {/* Add new subject */}
          {adding ? (
            <div className="p-3 flex flex-col gap-2.5">
              <input
                ref={nameRef}
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Subject name"
                maxLength={40}
                className="w-full bg-surface border border-border rounded-md px-2.5 py-1.5 text-sm text-bright placeholder:text-muted focus:outline-none focus:border-accent"
              />

              {/* Color swatches */}
              <div className="flex gap-1.5 flex-wrap">
                {SUBJECT_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={clsx(
                      'w-5 h-5 rounded-full transition-transform duration-100',
                      newColor === c
                        ? 'ring-2 ring-white ring-offset-1 ring-offset-card scale-110'
                        : 'hover:scale-110'
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>

              {/* Confirm / cancel */}
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  disabled={!newName.trim()}
                  className="flex-1 py-1.5 rounded-md bg-accent text-white text-xs font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  Add
                </button>
                <button
                  onClick={() => { setAdding(false); setNewName('') }}
                  className="flex-1 py-1.5 rounded-md bg-surface border border-border text-dim text-xs hover:text-soft transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-dim hover:text-soft hover:bg-surface transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              New subject
            </button>
          )}
        </div>
      )}
    </div>
  )
}
