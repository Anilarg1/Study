import PomodoroTimer from './components/PomodoroTimer'

export default function App() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      {/* wordmark */}
      <header className="mb-8 text-center">
        <h1 className="text-lg font-semibold tracking-[0.3em] text-dim uppercase select-none">
          Notebook
        </h1>
      </header>

      <main className="w-full max-w-sm">
        <PomodoroTimer />
      </main>
    </div>
  )
}
