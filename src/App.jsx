import { useEffect, useState } from 'react'
import AuthForm      from './components/AuthForm'
import Sidebar       from './components/Sidebar'
import PomodoroTimer from './components/PomodoroTimer'
import StreakDisplay from './components/StreakDisplay'
import useAuthStore  from './store/useAuthStore'

// ─── page views ───────────────────────────────────────────────────────────────

function TimerPage() {
  return (
    <div className="flex items-center justify-center min-h-full py-6">
      <PomodoroTimer />
    </div>
  )
}

function StreakPage() {
  return (
    <div className="max-w-sm mx-auto py-6">
      <div className="bg-card border border-border rounded-xl p-6">
        <StreakDisplay />
      </div>
    </div>
  )
}

// ─── app ─────────────────────────────────────────────────────────────────────

export default function App() {
  const { user, loading, init } = useAuthStore()
  const [activePage, setActivePage] = useState('timer')

  // Restore any existing Supabase session once on mount.
  // clockIn() is called inside init() *after* Supabase dates are loaded.
  useEffect(() => { init() }, [init])

  // ── loading splash ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <span className="text-dim text-sm tracking-widest animate-pulse">loading…</span>
      </div>
    )
  }

  // ── auth gate ───────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
        <header className="mb-10 text-center">
          <h1 className="text-[10px] font-semibold tracking-[0.3em] text-dim uppercase select-none">
            Notebook
          </h1>
        </header>
        <AuthForm />
      </div>
    )
  }

  // ── main app — Linear-inspired shell ────────────────────────────────────────
  return (
    <div className="h-screen flex overflow-hidden bg-bg">

      {/* left sidebar */}
      <Sidebar activePage={activePage} setActivePage={setActivePage} />

      {/* right: top bar + scrollable content */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* thin top bar */}
        <div className="h-11 border-b border-border flex items-center px-5 shrink-0 bg-surface">
          <span className="text-[11px] text-dim tracking-wide capitalize select-none">
            {activePage}
          </span>
        </div>

        {/* scrollable content area */}
        <main className="flex-1 overflow-auto px-6">
          {activePage === 'timer'  && <TimerPage  />}
          {activePage === 'streak' && <StreakPage />}
        </main>

      </div>

    </div>
  )
}
