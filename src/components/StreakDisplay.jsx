import useStreakStore, { toLocalDateStr } from '../store/useStreakStore'

// ─── helpers ─────────────────────────────────────────────────────────────────

const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] // Sun → Sat

/** Returns the last 7 days (oldest → newest) with metadata */
function getLast7() {
  return Array.from({ length: 7 }, (_, i) => {
    const d     = new Date(Date.now() - (6 - i) * 86_400_000)
    return {
      dateStr: toLocalDateStr(d),
      label:   DAY_INITIALS[d.getDay()],
      isToday: i === 6,
    }
  })
}

// ─── component ───────────────────────────────────────────────────────────────

export default function StreakDisplay() {
  const loginDates    = useStreakStore(s => s.loginDates)
  const longestStreak = useStreakStore(s => s.longestStreak)
  const currentStreak = useStreakStore(s => s.currentStreak)
  const clockedIn     = useStreakStore(s => s.clockedInToday)

  const dateSet = new Set(loginDates)
  const last7   = getLast7()

  return (
    <div className="w-full select-none">

      {/* ── header row ── */}
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs text-dim tracking-widest uppercase">Streak</span>
        <span className="text-lg font-semibold text-accent">
          🔥 {currentStreak}
        </span>
      </div>

      {/* ── 7-day dot row ── */}
      <div className="flex justify-between">
        {last7.map(({ dateStr, label, isToday }) => {
          const logged = dateSet.has(dateStr)
          return (
            <div key={dateStr} className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  'w-2 h-2 rounded-full transition-colors duration-300',
                  logged
                    ? isToday ? 'bg-green' : 'bg-accent'
                    : 'bg-muted',
                ].join(' ')}
              />
              <span className={`text-[9px] ${isToday ? 'text-bright' : 'text-dim'}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>

      {/* ── footer row ── */}
      <div className="flex justify-between mt-2 text-[10px] text-dim">
        <span>best: {longestStreak} day{longestStreak !== 1 ? 's' : ''}</span>
        <span className={clockedIn ? 'text-green' : 'text-amber'}>
          {clockedIn ? '✓ clocked in today' : '○ not yet today'}
        </span>
      </div>

    </div>
  )
}
