import { useEffect } from 'react'
import PomodoroTimer from './components/PomodoroTimer'
import StreakDisplay from './components/StreakDisplay'
import useStreakStore from './store/useStreakStore'

export default function App() {
  const clockIn = useStreakStore(s => s.clockIn)

  // Clock in once on every app load
  useEffect(() => { clockIn() }, [clockIn])

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">

      {/* wordmark */}
      <header className="mb-8 text-center">
        <h1 className="text-lg font-semibold tracking-[0.3em] text-dim uppercase select-none">
          Notebook
        </h1>
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
