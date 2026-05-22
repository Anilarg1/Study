import { useEffect } from 'react'
import PomodoroTimer from './components/PomodoroTimer'
import StreakDisplay from './components/StreakDisplay'
import AuthForm      from './components/AuthForm'
import useAuthStore  from './store/useAuthStore'

export default function App() {
  const { user, loading, init, signOut } = useAuthStore()

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
          <h1 className="text-lg font-semibold tracking-[0.3em] text-dim uppercase select-none">
            Notebook
          </h1>
        </header>
        <AuthForm />
      </div>
    )
  }

  // ── main app ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">

      <header className="mb-8 flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-[0.3em] text-dim uppercase select-none">
          Notebook
        </h1>
        <span className="text-muted text-[10px]">·</span>
        <button
          onClick={signOut}
          className="text-[10px] text-muted hover:text-dim tracking-wider transition-colors"
        >
          sign out
        </button>
      </header>

      <main className="w-full max-w-sm flex flex-col gap-6">
        <PomodoroTimer />

        {/* divider */}
        <div className="h-px bg-border" />

        <StreakDisplay />
      </main>

    </div>
  )
}
