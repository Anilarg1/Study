import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import useSubjectStore from '../store/useSubjectStore'
import useStreakStore, { calcCurrentStreak } from '../store/useStreakStore'
import { SUBJECT_COLORS } from '../lib/subjects'

// ── icons ─────────────────────────────────────────────────────────────────

function IcTimer() {
  return (
    <svg className="ni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M9 2h6"/>
    </svg>
  )
}
function IcStreak() {
  return (
    <svg className="ni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>
    </svg>
  )
}
function IcToday() {
  return (
    <svg className="ni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="4" y="4" width="16" height="16" rx="3"/>
      <path d="M9 17V11M12 17V8M15 17v-4"/>
    </svg>
  )
}
function IcStats() {
  return (
    <svg className="ni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 21h18"/><path d="M6 17v-6M11 17V9M16 17v-4M21 17V6"/>
    </svg>
  )
}
function IcTimetable() {
  return (
    <svg className="ni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="3" y="5" width="18" height="16" rx="2"/>
      <path d="M3 9h18M8 3v4M16 3v4"/>
    </svg>
  )
}
function IcNotes() {
  return (
    <svg className="ni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4V4z"/>
      <path d="M4 4v12a4 4 0 0 0 4 4"/>
    </svg>
  )
}
function IcFlash() {
  return (
    <svg className="ni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
    </svg>
  )
}
function IcPlus() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  )
}
function IcSignOut() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}
function IcSettings() {
  return (
    <svg className="ni-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}
/** Chevron pointing left (collapse) or right (expand) */
function IcChevron({ right }: { right?: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
         style={{ transition: 'transform 220ms cubic-bezier(.4,0,.2,1)', transform: right ? 'rotate(180deg)' : 'none' }}>
      <path d="M15 18l-6-6 6-6"/>
    </svg>
  )
}

// ── component ─────────────────────────────────────────────────────────────

interface SidebarProps {
  user:      User
  initials:  string
  email:     string
  onSignOut: () => void
  collapsed: boolean
  onToggle:  () => void
}

export default function Sidebar({
  user, initials, email, onSignOut, collapsed, onToggle,
}: SidebarProps) {
  const displayName = (user.user_metadata?.display_name as string | undefined) || email.split('@')[0]
  const navigate = useNavigate()
  const location = useLocation()

  const subjects      = useSubjectStore(s => s.subjects)
  const addSubject    = useSubjectStore(s => s.addSubject)
  const loginDates    = useStreakStore(s => s.loginDates)
  const currentStreak = calcCurrentStreak(new Set(loginDates))

  const [showAddPanel, setShowAddPanel] = useState(false)
  const [newName,      setNewName]      = useState('')
  const [newColor,     setNewColor]     = useState(SUBJECT_COLORS[0])
  const [addError,     setAddError]     = useState<string | null>(null)
  const [submitting,   setSubmitting]   = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  // Auto-focus the name input whenever the panel opens
  useEffect(() => {
    if (showAddPanel) nameRef.current?.focus()
  }, [showAddPanel])

  useEffect(() => {
    if (collapsed) {
      setShowAddPanel(false)
      setNewName('')
      setNewColor(SUBJECT_COLORS[0])
      setAddError(null)
      setSubmitting(false)
    }
  }, [collapsed])

  function toggleAddPanel() {
    setShowAddPanel(p => {
      if (p) {          // closing — reset form
        setNewName('')
        setNewColor(SUBJECT_COLORS[0])
        setAddError(null)
      }
      return !p
    })
  }

  async function handleAddSubject() {
    if (!newName.trim() || submitting) return
    setSubmitting(true)
    setAddError(null)
    const subject = await addSubject(newName.trim(), newColor)
    setSubmitting(false)
    if (subject) {
      setShowAddPanel(false)
      setNewName('')
      setNewColor(SUBJECT_COLORS[0])
    } else {
      setAddError('Could not save — check your connection.')
    }
  }

  async function handleAddKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter')  await handleAddSubject()
    if (e.key === 'Escape') toggleAddPanel()
  }

  return (
    <nav className="v2-nav">

      {/* ── Collapse toggle ── */}
      <div className="nav-toggle">
        <button
          className="nav-toggle-btn"
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar  [' : 'Collapse sidebar  ['}
        >
          <IcChevron right={collapsed} />
        </button>
      </div>

      {/* ── Practice section ── */}
      {!collapsed && (
        <div className="nav-section-hd">
          <span className="nav-section-label">Practice</span>
        </div>
      )}

      <button
        className={`nav-item${location.pathname === '/' ? ' active' : ''}`}
        title="Timer"
        onClick={() => navigate('/')}
      >
        <IcTimer />
        <span className="nav-label">Timer</span>
        <span className="ni-shortcut">G T</span>
      </button>
      <button className="nav-item" title={`Streak${currentStreak > 0 ? ` — ${currentStreak} days` : ''}`}>
        <IcStreak />
        <span className="nav-label">Streak</span>
        <span className="ni-count">{currentStreak > 0 ? currentStreak : '—'}</span>
      </button>
      <button className="nav-item" title="Today">
        <IcToday />
        <span className="nav-label">Today</span>
        <span className="ni-shortcut">G D</span>
      </button>
      <button
        className={`nav-item${location.pathname === '/stats' ? ' active' : ''}`}
        title="Stats"
        onClick={() => navigate('/stats')}
      >
        <IcStats />
        <span className="nav-label">Stats</span>
        <span className="ni-shortcut">G S</span>
      </button>
      <button className="nav-item muted" title="Timetable — coming soon">
        <IcTimetable />
        <span className="nav-label">Timetable</span>
        <span className="ni-count">SOON</span>
      </button>

      {/* ── Library section ── */}
      {!collapsed && (
        <div className="nav-section-hd">
          <span className="nav-section-label">Library</span>
          <button className="nav-section-ic" title="New note"><IcPlus /></button>
        </div>
      )}

      <button className="nav-item" title="Notes">
        <IcNotes />
        <span className="nav-label">Notes</span>
        <span className="ni-count">—</span>
      </button>
      <button className="nav-item" title="Flashcards">
        <IcFlash />
        <span className="nav-label">Flashcards</span>
        <span className="ni-count">—</span>
      </button>

      {/* ── Subjects section ── */}
      {!collapsed && (
        <div className="nav-section-hd">
          <span className="nav-section-label">Subjects</span>
          <button
            className="nav-section-ic"
            title={showAddPanel ? 'Cancel' : 'New subject'}
            onClick={toggleAddPanel}
          >
            <IcPlus />
          </button>
        </div>
      )}

      {showAddPanel && !collapsed && (
        <div style={{ padding: '6px 8px 8px', borderBottom: '1px solid var(--hairline)' }}>
          <input
            ref={nameRef}
            type="text"
            value={newName}
            onChange={e => { setNewName(e.target.value); setAddError(null) }}
            onKeyDown={handleAddKeyDown}
            placeholder="Subject name"
            maxLength={40}
            style={{
              width: '100%',
              background: 'var(--surface-3)',
              border: '1px solid var(--hairline-2)',
              borderRadius: 6,
              padding: '5px 8px',
              fontSize: 12,
              color: 'var(--text)',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
            {SUBJECT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: c,
                  border: newColor === c ? '2px solid var(--text)' : '2px solid transparent',
                  outline: newColor === c ? '2px solid var(--surface-3)' : 'none',
                  outlineOffset: 1,
                  padding: 0,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
          {addError && (
            <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: '#f87171' }}>
              {addError}
            </span>
          )}
        </div>
      )}

      {!collapsed && subjects.length === 0 && (
        <span style={{ fontSize: '11.5px', color: 'var(--text-faint)', padding: '4px 8px', display: 'block' }}>
          No subjects yet
        </span>
      )}

      {subjects.map(s => (
        <button key={s.id} className="nav-item" title={s.name}>
          <span className="subj-dot" style={{ background: s.color }} />
          <span className="nav-label">{s.name}</span>
        </button>
      ))}

      <div className="nav-spacer" />

      {/* ── Settings ── */}
      <button
        className={`nav-item${location.pathname === '/settings' ? ' active' : ''}`}
        onClick={() => navigate('/settings')}
        title="Settings"
      >
        <IcSettings />
        <span className="nav-label">Settings</span>
      </button>

      {/* ── User row ── */}
      <div className="nav-user">
        <div className="avatar">{initials}</div>
        <div className="nav-user-info">
          <span style={{ fontSize: '12.5px', color: 'var(--text)', fontWeight: 500 }}>
            {displayName}
          </span>
          <span style={{ fontSize: '10.5px', color: 'var(--text-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {email}
          </span>
        </div>
        <button className="nav-signout" onClick={onSignOut} title="Sign out">
          <IcSignOut />
        </button>
      </div>

    </nav>
  )
}
