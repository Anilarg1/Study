import { useEffect, useCallback, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import LoginPage       from './components/LoginPage'
import Sidebar         from './components/Sidebar'
import RightRail       from './components/RightRail'
import NewSessionModal from './components/NewSessionModal'
import CommandPalette  from './components/CommandPalette'
import TimerPage       from './pages/TimerPage'
import SettingsPage    from './pages/SettingsPage'
import StatsPage       from './pages/StatsPage'
import NotesPage       from './pages/NotesPage'
import FlashcardsPage  from './pages/FlashcardsPage'
import TimetablePage   from './pages/TimetablePage'
import PastPapersPage  from './pages/PastPapersPage'
import useAuthStore     from './store/useAuthStore'
import useTimerStore    from './store/useTimerStore'
import useSubjectStore  from './store/useSubjectStore'
import useSettingsStore from './store/useSettingsStore'
import { IcTimer as TimerIcon, IcGear as GearIcon } from './components/icons'

const DATA_MODE: Record<string, string> = { work: 'focus', shortBreak: 'short', longBreak: 'long' }

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()

  const { user, loading, init, signOut } = useAuthStore()
  const timerMode        = useTimerStore(s => s.mode)
  const running          = useTimerStore(s => s.running)
  const startTimer       = useTimerStore(s => s.start)
  const setTimerMode     = useTimerStore(s => s.setMode)
  const setTimerDuration = useTimerStore(s => s.setDuration)
  const setTimerSubject  = useTimerStore(s => s.setSubjectId)
  const setTimerTagId    = useTimerStore(s => s.setTagId)
  const setActiveId      = useSubjectStore(s => s.setActiveId)
  const dataMode         = DATA_MODE[timerMode] ?? 'focus'

  const sidebarCollapsed = useSettingsStore(s => s.sidebarCollapsed)
  const toggleSidebar    = useSettingsStore(s => s.toggle)

  const [showNewSession, setShowNewSession] = useState(false)
  const [showCmdPalette, setShowCmdPalette] = useState(false)

  const handleNewSession = useCallback(() => {
    setShowNewSession(true)
  }, [])

  const handleStartSession = useCallback((
    subjectId: string | null,
    durationMins: number,
    tagId: string | null,
  ) => {
    setShowNewSession(false)
    setActiveId(subjectId)
    setTimerSubject(subjectId)
    setTimerTagId(tagId)
    setTimerDuration('work', durationMins)
    setTimerMode('work')
    startTimer()
    navigate('/')
  }, [setActiveId, setTimerSubject, setTimerTagId, setTimerDuration, setTimerMode, startTimer, navigate])

  useEffect(() => { init() }, [init])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowCmdPalette(p => !p)
        return
      }
      if ((e.target as HTMLElement).matches('input, textarea')) return
      if (e.key.toLowerCase() === 'c') handleNewSession()
      if (e.key === '[') toggleSidebar('sidebarCollapsed')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleNewSession, toggleSidebar])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-mute)', fontSize: '12px', letterSpacing: '0.2em' }}>
          loading…
        </span>
      </div>
    )
  }

  if (!user) return <LoginPage />

  const email       = user.email ?? ''
  const emailHandle = email.split('@')[0] ?? ''
  const displayName = (user.user_metadata?.display_name as string | undefined) ?? ''
  const handle      = displayName || emailHandle
  const initials    = handle.slice(0, 2).toUpperCase()

  const isSettings = location.pathname === '/settings'
  const showRail   = !isSettings

  return (
    <div
      className="app-shell"
      data-mode={dataMode}
      data-view={isSettings ? 'settings' : 'timer'}
      {...(sidebarCollapsed ? { 'data-nav-collapsed': '' } : {})}
    >

      {/* ── BRAND CORNER ── */}
      <div className="brand-corner">
        <div className="brand-logo">N</div>
        <span className="brand-text" style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text)' }}>
          Notebook
          <span style={{ color: 'var(--text-dim)', fontWeight: 450, marginLeft: 6 }}>
            / {handle}
          </span>
        </span>
        <button className="icon-btn brand-chevron" style={{ marginLeft: 'auto' }} title="Switch workspace">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="m7 9 5-5 5 5M7 15l5 5 5-5"/>
          </svg>
        </button>
      </div>

      {/* ── TOPBAR ── */}
      <div className="topbar">
        {isSettings ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-dim)' }}>
            <GearIcon size={14} className={undefined} />
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>Settings</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-dim)' }}>
            <TimerIcon size={14} className={undefined} />
            <span>Practice</span>
            <span style={{ color: 'var(--text-faint)' }}>/</span>
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>Timer</span>
          </div>
        )}

        <div style={{ flex: 1 }} />

        <button className="cmd-palette" onClick={() => setShowCmdPalette(true)}>
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

        <button className="icon-btn" title="Notifications">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.7 21a2 2 0 0 1-3.4 0"/>
          </svg>
        </button>

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
        collapsed={sidebarCollapsed}
        onToggle={() => toggleSidebar('sidebarCollapsed')}
      />

      {/* ── MAIN ── */}
      <Routes>
        <Route path="/"            element={<TimerPage />} />
        <Route path="/settings"    element={<SettingsPage />} />
        <Route path="/stats"       element={<StatsPage />} />
        <Route path="/notes"       element={<NotesPage />} />
        <Route path="/flashcards"  element={<FlashcardsPage />} />
        <Route path="/timetable"   element={<TimetablePage />} />
        <Route path="/past-papers" element={<PastPapersPage />} />
      </Routes>

      {/* ── RAIL (hidden on non-timer routes) ── */}
      {showRail && <RightRail />}

      {/* ── OVERLAYS ── */}
      {showNewSession && (
        <NewSessionModal
          running={running}
          onStart={handleStartSession}
          onCancel={() => setShowNewSession(false)}
        />
      )}

      <CommandPalette
        open={showCmdPalette}
        onClose={() => setShowCmdPalette(false)}
        onNavigate={path => navigate(path)}
        onNewSession={() => { setShowCmdPalette(false); setShowNewSession(true) }}
      />

    </div>
  )
}
