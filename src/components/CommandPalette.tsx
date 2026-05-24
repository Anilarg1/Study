import { useEffect, useRef, useState } from 'react'
import useSubjectStore from '../store/useSubjectStore'

// ── icons ─────────────────────────────────────────────────────────────────

function IcSearch() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
    </svg>
  )
}
function IcTimer() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M9 2h6"/>
    </svg>
  )
}
function IcGear() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}
function IcPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  )
}

// ── types ─────────────────────────────────────────────────────────────────

interface CmdItem {
  id:        string
  label:     string
  hint?:     string
  icon:      React.ReactNode
  action:    () => void
}

interface CommandPaletteProps {
  open:         boolean
  onClose:      () => void
  onNavigate:   (view: 'timer' | 'settings') => void
  onNewSession: () => void
}

// ── component ─────────────────────────────────────────────────────────────

export default function CommandPalette({
  open, onClose, onNavigate, onNewSession,
}: CommandPaletteProps) {
  const subjects    = useSubjectStore(s => s.subjects)
  const setActiveId = useSubjectStore(s => s.setActiveId)
  const activeId    = useSubjectStore(s => s.activeId)

  const activeSubject = subjects.find(s => s.id === activeId) ?? null

  const [query,   setQuery]   = useState('')
  const [focused, setFocused] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)

  // ── command groups ───────────────────────────────────────────────────────

  const actionCmds: CmdItem[] = [
    {
      id:     'new-session',
      label:  activeSubject ? `New session · ${activeSubject.name}` : 'New session',
      hint:   'C',
      icon:   <IcPlus />,
      action: () => { onNewSession(); onClose() },
    },
    {
      id:     'goto-timer',
      label:  'Go to Timer',
      hint:   'G T',
      icon:   <IcTimer />,
      action: () => { onNavigate('timer'); onClose() },
    },
    {
      id:     'goto-settings',
      label:  'Go to Settings',
      icon:   <IcGear />,
      action: () => { onNavigate('settings'); onClose() },
    },
  ]

  const subjectCmds: CmdItem[] = subjects.map(s => ({
    id:     `subject-${s.id}`,
    label:  s.name,
    hint:   'Subject',
    icon:   <span className="subj-dot" style={{ background: s.color }} />,
    action: () => { setActiveId(s.id); onClose() },
  }))

  // ── filtered list ────────────────────────────────────────────────────────

  const q = query.trim().toLowerCase()
  const allCmds  = [...actionCmds, ...subjectCmds]
  const filtered = q
    ? allCmds.filter(c => c.label.toLowerCase().includes(q))
    : allCmds

  // ── reset on open ────────────────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      setQuery('')
      setFocused(0)
      // defer focus so the element is visible
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // reset cursor when query changes
  useEffect(() => { setFocused(0) }, [query])

  // scroll focused item into view
  useEffect(() => {
    const item = listRef.current?.children[focused] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [focused])

  // ── keyboard navigation (while palette is open) ──────────────────────────

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowDown':
          e.preventDefault()
          setFocused(f => Math.min(f + 1, filtered.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocused(f => Math.max(f - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          filtered[focused]?.action()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, focused, filtered, onClose])

  if (!open) return null

  // ── render ───────────────────────────────────────────────────────────────

  // Build sections for unfiltered view
  const showSections = !q

  return (
    <div
      className="cp-overlay"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="cp-modal" role="dialog" aria-label="Command palette">

        {/* Search row */}
        <div className="cp-search-row">
          <span className="cp-search-ic"><IcSearch /></span>
          <input
            ref={inputRef}
            className="cp-input"
            placeholder="Search subjects, go to settings, start session…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <span className="kbd-badge">esc</span>
        </div>

        {/* List */}
        <div className="cp-list" ref={listRef}>
          {filtered.length === 0 && (
            <div className="cp-empty">No results for &ldquo;{query}&rdquo;</div>
          )}

          {showSections ? (
            <>
              <div className="cp-group-label">Actions</div>
              {actionCmds.map((cmd, i) => (
                <CpItem
                  key={cmd.id}
                  cmd={cmd}
                  isFocused={focused === i}
                  onHover={() => setFocused(i)}
                />
              ))}

              {subjectCmds.length > 0 && (
                <>
                  <div className="cp-group-label">Subjects</div>
                  {subjectCmds.map((cmd, i) => (
                    <CpItem
                      key={cmd.id}
                      cmd={cmd}
                      isFocused={focused === actionCmds.length + i}
                      onHover={() => setFocused(actionCmds.length + i)}
                    />
                  ))}
                </>
              )}
            </>
          ) : (
            filtered.map((cmd, i) => (
              <CpItem
                key={cmd.id}
                cmd={cmd}
                isFocused={focused === i}
                onHover={() => setFocused(i)}
              />
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="cp-footer">
          <span><span className="kbd-badge">↑↓</span> navigate</span>
          <span><span className="kbd-badge">↵</span> select</span>
          <span><span className="kbd-badge">esc</span> close</span>
        </div>

      </div>
    </div>
  )
}

// ── sub-component: single list item ──────────────────────────────────────

function CpItem({
  cmd, isFocused, onHover,
}: { cmd: CmdItem; isFocused: boolean; onHover: () => void }) {
  return (
    <button
      className={`cp-item${isFocused ? ' focused' : ''}`}
      onMouseMove={onHover}
      onClick={cmd.action}
    >
      <span className="cp-item-ic">{cmd.icon}</span>
      <span className="cp-item-label">{cmd.label}</span>
      {cmd.hint && <span className="cp-item-hint">{cmd.hint}</span>}
    </button>
  )
}
