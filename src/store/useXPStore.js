import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { xpToLevel, xpProgress, xpToNextLevel, XP_REWARDS } from '../utils/xp'

const useXPStore = create(
  persist(
    (set, get) => ({
      totalXP:   0,
      sessions:  [],    // lightweight log: { id, type, completedAt, xp }

      /** Award XP for completing a session type */
      awardXP(sessionType) {
        const xp          = XP_REWARDS[sessionType] ?? 0
        const prevXP      = get().totalXP
        const prevLevel   = xpToLevel(prevXP)
        const newXP       = prevXP + xp
        const newLevel    = xpToLevel(newXP)
        const leveledUp   = newLevel > prevLevel

        const entry = {
          id:          crypto.randomUUID(),
          type:        sessionType,
          completedAt: new Date().toISOString(),
          xp,
        }

        set(state => ({
          totalXP:  newXP,
          sessions: [...state.sessions, entry],
        }))

        return { xp, leveledUp, newLevel }
      },

      // Derived getters (computed on read, no stored redundancy)
      get level()       { return xpToLevel(get().totalXP) },
      get progress()    { return xpProgress(get().totalXP) },
      get toNextLevel() { return xpToNextLevel(get().totalXP) },
    }),
    {
      name:    'notebook-xp',
      version: 1,
    }
  )
)

export default useXPStore
