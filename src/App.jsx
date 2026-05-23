import { useEffect, useCallback, useState } from 'react'
import LoginPage        from './components/LoginPage'
import Sidebar          from './components/Sidebar'
import PomodoroTimer    from './components/PomodoroTimer'
import RightRail        from './components/RightRail'
import NewSessionModal  from './components/NewSessionModal'
import Settings         from './components/Settings'
import useAuthStore     from './store/useAuthStore'
import useTimerStore    from './store/useTimerStore'
import useSubjectStore  from './store/useSubjectStore'

// mode key map: store names → CSS data-mode values
const DATA_MODE = { work: 'focus', shortBreak: 'short', longBreak: 'long' }

// ── breadcrumb icons ───────────────────────────────────────────────────────
function TimerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M9 2h6"/>
    </svg>
  )
}
function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

// ── app ───────────────────────────────────────────────────────────────────
export default function App() {
  const { user, loading, init, signOut } = useAuthStore()
  const timerMode        = useTimerStore(s => s.mode)
  const running          = useTimerStore(s => s.running)
  const startTimer       = useTimerStore(s => s.start)
  const setTimerMode     = useTimerStore(s => s.setMode)
  const setTimerDuration = useTimerStore(s => s.setDuration)
  const setTimerSubject  = useTimerStore(s => s.setSubjectId)
  const setActiveId      = useSubjectStore(s => s.setActiveId)
  const dataMode         = DATA_MODE[timerMode] ?? 'focus'

  const [showNewSession, setShowNewSession] = useState(false)
  const [view,           setView]           = useState('timer') // 'timer' | 'settings'

  const handleNewSession = useCallback(() => {
    setShowNewSession(true)
  }, [])

  const handleStartSession = useCallback((subjectId, durationMins) => {
    setShowNewSession(false)
    setActiveId(subjectId)
    setTimerSubject(subjectId)
    setTimerDuration('work', durationMins)   // updates customDurations.work
    setTimerMode('work')                     // resets remaining to new duration
    startTimer()
  }, [setActiveId, setTimerSubject, setTimerDuration, setTimerMode, startTimer])

  // Restore Supabase session once on mount
  useEffect(() => { init() }, [init])

  // Global keyboard shortcut: C → New session
  useEffect(() => {
    function onKey(e) {
      if (e.target.matches('input, textarea')) return
      if (e.key.toLowerCase() === 'c') handleNewSession()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleNewSession])

  // ── loading splash ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-mute)', fontSize: '12px', letterSpacing: '0.2em' }}>
          loading…
        </span>
      </div>
    )
  }

  // ── auth gate ───────────────────────────────────────────────────────────
  if (!user) return <LoginPage />

  // ── derive user display info ────────────────────────────────────────────
  const email    = user.email ?? ''
  const initials = email.slice(0, 2).toUpperCase()
  const handle   = email.split('@')[0]

  // ── main app — Linear-inspired 3-col shell ──────────────────────────────
  return (
    <div className="app-shell" data-mode={dataMode} data-view={view}>

      {/* ── BRAND CORNER ── */}
      <div className="brand-corner">
        <div className="brand-logo">N</div>
        <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text)' }}>
          Notebook
          <span style={{ color: 'var(--text-dim)', fontWeight: 450, marginLeft: 6 }}>
            / {handle}
          </span>
        </span>
        <button className="icon-btn" style={{ marginLeft: 'auto' }} title="Switch workspace">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="m7 9 5-5 5 5M7 15l5 5 5-5"/>
          </svg>
        </button>
      </div>

      {/* ── TOPBAR ── */}
      <div className="topbar">
        {/* breadcrumbs */}
        {view === 'timer' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-dim)' }}>
            <TimerIcon />
            <span>Practice</span>
            <span style={{ color: 'var(--text-faint)' }}>/</span>
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>Timer</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-dim)' }}>
            <GearIcon />
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>Settings</span>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* command palette */}
        <button className="cmd-palette">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
               style={{ color: 'var(--text-mute)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <span style={{ flex: 1, color: 'var(--text-dim)' }}>Jump to subject, session, settings…</span>
          <span style={{ display: 'flex', gap: 2 }}>
            <span className="kbd-badge">⌘</span>
            <span className="kbd-badge">K</span>
          </span>
        </button>

        {/* bell */}
        <button className="icon-btn" title="Notifications">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.7 21a2 2 0 0 1-3.4 0"/>
          </svg>
        </button>

        {/* new session */}
        <button className="top-btn primary" onClick={handleNewSession}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New session
          <span className="kbd-badge" style={{ background: 'rgba(0,0,0,0.18)', borderColor: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.85)' }}>C</span>
        </button>
      </div>

      {/* ── NAV ── */}
      <Sidebar
        user={user}
        initials={initials}
        email={email}
        onSignOut={signOut}
        activeView={view}
        onSettings={() => setView('settings')}
      />

      {/* ── MAIN ── */}
      {view === 'timer'    && <PomodoroTimer dataMode={dataMode} running={running} />}
      {view === 'settings' && <Settings onBack={() => setView('timer')} />}

      {/* ── RAIL (hidden in settings view) ── */}
      {view === 'timer' && <RightRail />}

      {/* ── NEW SESSION MODAL ── */}
      {showNewSession && (
        <NewSessionModal
          running={running}
          onStart={handleStartSession}
          onCancel={() => setShowNewSession(false)}
        />
      )}

    </div>
  )
}
