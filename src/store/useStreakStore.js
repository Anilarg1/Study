import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase, upsertDailyLogin } from '../lib/supabase'

// ─── helpers ─────────────────────────────────────────────────────────────────

/** 'YYYY-MM-DD' in the user's local timezone (avoids UTC-offset surprises) */
export function toLocalDateStr(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Consecutive-day streak ending on today (if clocked in) or yesterday
 * (so the streak stays visible until midnight if today isn't logged yet).
 */
function calcCurrentStreak(dateSet) {
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
function calcLongestStreak(dates) {
  if (!dates.length) return 0
  const sorted = [...new Set(dates)].sort()
  let longest = 1, run = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i]) - new Date(sorted[i - 1])) / 86_400_000
    if      (diff === 1) { run++; if (run > longest) longest = run }
    else if (diff  > 1) { run = 1 }
    // diff === 0 → duplicate date, skip
  }
  return longest
}

// ─── store ────────────────────────────────────────────────────────────────────

const useStreakStore = create(
  persist(
    (set, get) => ({
      /** ['YYYY-MM-DD', …] — mirrors Supabase daily_logins rows */
      loginDates:    [],
      longestStreak: 0,

      /**
       * Call once after sign-in sync is complete.
       * No-ops if today is already logged. Syncs to Supabase if signed in.
       */
      clockIn() {
        const today = toLocalDateStr()
        const { loginDates } = get()
        if (loginDates.includes(today)) return   // already clocked in

        const next    = [...loginDates, today]
        const longest = Math.max(get().longestStreak, calcLongestStreak(next))
        set({ loginDates: next, longestStreak: longest })

        // Fire-and-forget: sync to Supabase if signed in
        supabase.auth.getSession().then(({ data: { session } }) => {
          const userId = session?.user?.id
          if (userId) {
            upsertDailyLogin(userId, today).catch(console.error)
          }
        })
      },

      /**
       * Called by useAuthStore after sign-in.
       * Overwrites local login dates with the Supabase source of truth.
       */
      _importFromSupabase(dates) {
        const longest = calcLongestStreak(dates)
        set({
          loginDates:    dates,
          longestStreak: Math.max(get().longestStreak, longest),
        })
      },

      /** Called by useAuthStore on sign-out. */
      _reset() {
        set({ loginDates: [], longestStreak: 0 })
      },

      // ── derived (computed on read, not persisted) ──
      get currentStreak() { return calcCurrentStreak(new Set(get().loginDates)) },
      get clockedInToday() { return get().loginDates.includes(toLocalDateStr()) },
    }),
    {
      name:    'notebook-streak',
      version: 1,
    }
  )
)

export default useStreakStore
