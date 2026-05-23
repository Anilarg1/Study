import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { upsertDailyLogin } from '../lib/supabase'
import { getCurrentUserId } from '../lib/currentUser'

// ─── helpers ─────────────────────────────────────────────────────────────────

/** 'YYYY-MM-DD' in the user's local timezone (avoids UTC-offset surprises) */
export function toLocalDateStr(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Consecutive-day streak ending on today (if clocked in) or yesterday
 * (so the streak stays visible until midnight if today isn't logged yet).
 *
 * Exported so components can compute this reactively from loginDates without
 * relying on Zustand getters (which lose reactivity after the first Object.assign).
 */
export function calcCurrentStreak(dateSet: Set<string>): number {
  const today     = toLocalDateStr()
  const yesterday = toLocalDateStr(new Date(Date.now() - 86_400_000))

  const anchor = dateSet.has(today)
    ? today
    : dateSet.has(yesterday)
      ? yesterday
      : null

  if (!anchor) return 0

  let streak = 1
  let cur = new Date(anchor)
  while (true) {
    cur = new Date(cur.getTime() - 86_400_000)
    if (dateSet.has(toLocalDateStr(cur))) streak++
    else break
  }
  return streak
}

/** All-time longest consecutive-day run */
function calcLongestStreak(dates: string[]): number {
  if (!dates.length) return 0
  const sorted = [...new Set(dates)].sort()
  let longest = 1, run = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) / 86_400_000
    if      (diff === 1) { run++; if (run > longest) longest = run }
    else if (diff  > 1) { run = 1 }
    // diff === 0 → duplicate date, skip
  }
  return longest
}

// ─── store ────────────────────────────────────────────────────────────────────

interface StreakState {
  loginDates:    string[]
  longestStreak: number

  clockIn(): void
  _importFromSupabase(dates: string[]): void
  _reset(): void
}

const useStreakStore = create<StreakState>()(
  persist(
    (set, get) => ({
      loginDates:    [],
      longestStreak: 0,

      clockIn() {
        const today = toLocalDateStr()
        const { loginDates } = get()
        if (loginDates.includes(today)) return

        const next    = [...loginDates, today]
        const longest = Math.max(get().longestStreak, calcLongestStreak(next))
        set({ loginDates: next, longestStreak: longest })

        const userId = getCurrentUserId()
        if (userId) {
          upsertDailyLogin(userId, today).catch(console.error)
        }
      },

      _importFromSupabase(dates) {
        const longest = calcLongestStreak(dates)
        set({
          loginDates:    dates,
          longestStreak: Math.max(get().longestStreak, longest),
        })
      },

      _reset() {
        set({ loginDates: [], longestStreak: 0 })
      },

      // NOTE: currentStreak and clockedInToday are intentionally NOT stored as
      // Zustand getters. Zustand uses Object.assign for state merges, which
      // evaluates and freezes getter values — they stop updating after the first
      // set() call. Compute these values in components instead:
      //
      //   const loginDates    = useStreakStore(s => s.loginDates)
      //   const currentStreak = useMemo(() => calcCurrentStreak(new Set(loginDates)), [loginDates])
    }),
    {
      name:    'notebook-streak',
      version: 1,
    }
  )
)

export default useStreakStore
