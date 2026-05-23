import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { xpToLevel, xpProgress, xpToNextLevel, XP_REWARDS } from '../utils/xp'
import { supabase, insertSession, upsertUserXP } from '../lib/supabase'

const useXPStore = create(
  persist(
    (set, get) => ({
      totalXP:   0,
      sessions:  [],    // lightweight log: { id, type, completedAt, xp }

      /** Award XP for completing a session type. Pass subjectId (uuid) to tag the session. */
      awardXP(sessionType, subjectId = null) {
        const xp        = XP_REWARDS[sessionType] ?? 0
        const prevXP    = get().totalXP
        const prevLevel = xpToLevel(prevXP)
        const newXP     = prevXP + xp
        const newLevel  = xpToLevel(newXP)
        const leveledUp = newLevel > prevLevel

        const entry = {
          id:          crypto.randomUUID(),
          type:        sessionType,
          completedAt: new Date().toISOString(),
          xp,
          subjectId:   subjectId ?? null,
        }

        set(state => ({
          totalXP:  newXP,
          sessions: [...state.sessions, entry],
        }))

        // Fire-and-forget: sync to Supabase if the user is signed in
        supabase.auth.getSession().then(({ data: { session } }) => {
          const userId = session?.user?.id
          if (userId) {
            insertSession(userId, entry).catch(console.error)
            upsertUserXP(userId, newXP).catch(console.error)
          }
        })

        return { xp, leveledUp, newLevel }
      },

      /**
       * Called by useAuthStore after sign-in.
       * Uses whichever is higher — local (earned this session) or Supabase — so
       * a failed fire-and-forget upsert never silently wipes locally earned XP.
       */
      _importFromSupabase(xp) {
        set(state => ({ totalXP: Math.max(state.totalXP, xp) }))
      },

      /** Called by useAuthStore on sign-out. */
      _reset() {
        set({ totalXP: 0, sessions: [] })
      },

      // Derived getters (computed on read, no stored redundancy)
      get level()       { return xpToLevel(get().totalXP) },
      get progress()    { return xpProgress(get().totalXP) },
      get toNextLevel() { return xpToNextLevel(get().totalXP) },
    }),
    {
      name:    'notebook-xp',
      version: 1,
      partialize: state => ({
        totalXP:  state.totalXP,
        sessions: state.sessions,
      }),
    }
  )
)

export default useXPStore
