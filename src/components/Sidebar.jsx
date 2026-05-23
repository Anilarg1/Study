import useSubjectStore from '../store/useSubjectStore'
import useStreakStore, { calcCurrentStreak, toLocalDateStr } from '../store/useStreakStore'

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

// ── component ─────────────────────────────────────────────────────────────

export default function Sidebar({ user, initials, email, onSignOut, activeView, onSettings }) {
  const subjects    = useSubjectStore(s => s.subjects)
  const loginDates  = useStreakStore(s => s.loginDates)
  const currentStreak = calcCurrentStreak(new Set(loginDates))

  return (
    <nav className="v2-nav">

      {/* ── Practice section ── */}
      <div className="nav-section-hd">
        <span className="nav-section-label">Practice</span>
      </div>

      <button className="nav-item active">
        <IcTimer />
        Timer
        <span className="ni-shortcut">G T</span>
      </button>
      <button className="nav-item">
        <IcStreak />
        Streak
        <span className="ni-count">{currentStreak > 0 ? currentStreak : '—'}</span>
      </button>
      <button className="nav-item">
        <IcToday />
        Today
        <span className="ni-shortcut">G D</span>
      </button>
      <button className="nav-item muted">
        <IcStats />
        Stats
        <span className="ni-count">SOON</span>
      </button>
      <button className="nav-item muted">
        <IcTimetable />
        Timetable
        <span className="ni-count">SOON</span>
      </button>

      {/* ── Library section ── */}
      <div className="nav-section-hd">
        <span className="nav-section-label">Library</span>
        <button className="nav-section-ic" title="New note"><IcPlus /></button>
      </div>

      <button className="nav-item">
        <IcNotes />
        Notes
        <span className="ni-count">—</span>
      </button>
      <button className="nav-item">
        <IcFlash />
        Flashcards
        <span className="ni-count">—</span>
      </button>

      {/* ── Subjects section ── */}
      <div className="nav-section-hd">
        <span className="nav-section-label">Subjects</span>
        <button className="nav-section-ic" title="New subject"><IcPlus /></button>
      </div>

      {subjects.length === 0 && (
        <span style={{ fontSize: '11.5px', color: 'var(--text-faint)', padding: '4px 8px', display: 'block' }}>
          No subjects yet
        </span>
      )}

      {subjects.map(s => (
        <button key={s.id} className="nav-item">
          <span className="subj-dot" style={{ background: s.color }} />
          {s.name}
        </button>
      ))}

      <div className="nav-spacer" />

      {/* ── Settings ── */}
      <button
        className={`nav-item${activeView === 'settings' ? ' active' : ''}`}
        onClick={onSettings}
      >
        <IcSettings />
        Settings
      </button>

      {/* ── User row ── */}
      <div className="nav-user">
        <div className="avatar">{initials}</div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontSize: '12.5px', color: 'var(--text)', fontWeight: 500 }}>
            {email.split('@')[0]}
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
