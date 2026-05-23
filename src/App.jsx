import { useEffect, useCallback } from 'react'
import AuthForm      from './components/AuthForm'
import Sidebar       from './components/Sidebar'
import PomodoroTimer from './components/PomodoroTimer'
import RightRail     from './components/RightRail'
import useAuthStore  from './store/useAuthStore'
import useTimerStore from './store/useTimerStore'

// mode key map: store names → CSS data-mode values
const DATA_MODE = { work: 'focus', shortBreak: 'short', longBreak: 'long' }

// ── breadcrumb icon ────────────────────────────────────────────────────────
function TimerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M9 2h6"/>
    </svg>
  )
}

// ── app ───────────────────────────────────────────────────────────────────
export default function App() {
  const { user, loading, init, signOut } = useAuthStore()
  const timerMode    = useTimerStore(s => s.mode)
  const running      = useTimerStore(s => s.running)
  const startTimer   = useTimerStore(s => s.start)
  const setTimerMode = useTimerStore(s => s.setMode)
  const dataMode     = DATA_MODE[timerMode] ?? 'focus'

  const handleNewSession = useCallback(() => {
    if (running && !window.confirm('A session is in progress. Start a new one?')) return
    setTimerMode('work')
    startTimer()
  }, [running, setTimerMode, startTimer])

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
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
        <header style={{ marginBottom: '40px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
            <div className="brand-logo" style={{ width: 28, height: 28, fontSize: 13 }}>N</div>
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              Notebook
            </span>
          </div>
        </header>
        <AuthForm />
      </div>
    )
  }

  // ── derive user display info ────────────────────────────────────────────
  const email    = user.email ?? ''
  const initials = email.slice(0, 2).toUpperCase()
  const handle   = email.split('@')[0]

  // ── main app — Linear-inspired 3-col shell ──────────────────────────────
  return (
    <div className="app-shell" data-mode={dataMode}>

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-dim)' }}>
          <TimerIcon />
          <span>Practice</span>
          <span style={{ color: 'var(--text-faint)' }}>/</span>
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>Timer</span>
        </div>

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
      />

      {/* ── MAIN ── */}
      <PomodoroTimer dataMode={dataMode} running={running} />

      {/* ── RAIL ── */}
      <RightRail />

    </div>
  )
}
