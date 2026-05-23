import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { xpToLevel } from '../utils/xp'
import { XP_REWARDS } from '../utils/xp'
import { insertSession, upsertUserXP } from '../lib/supabase'
import { getCurrentUserId } from '../lib/currentUser'
import type { TimerMode, SessionEntry } from '../types'

const MAX_LOCAL_SESSIONS = 200

interface AwardResult {
  xp:       number
  leveledUp: boolean
  newLevel:  number
}

interface XPState {
  totalXP:  number
  sessions: SessionEntry[]

  awardXP(sessionType: TimerMode, subjectId?: string | null, durationSecs?: number | null): AwardResult
  _importFromSupabase(xp: number): void
  _reset(): void
}

const useXPStore = create<XPState>()(
  persist(
    (set, get) => ({
      totalXP:  0,
      sessions: [],

      awardXP(sessionType, subjectId = null, durationSecs = null) {
        const xp        = XP_REWARDS[sessionType] ?? 0
        const prevXP    = get().totalXP
        const prevLevel = xpToLevel(prevXP)
        const newXP     = prevXP + xp
        const newLevel  = xpToLevel(newXP)
        const leveledUp = newLevel > prevLevel

        const entry: SessionEntry = {
          id:           crypto.randomUUID(),
          type:         sessionType,
          completedAt:  new Date().toISOString(),
          xp,
          subjectId:    subjectId   ?? null,
          durationSecs: durationSecs ?? null,
        }

        set(state => ({
          totalXP:  newXP,
          sessions: [...state.sessions, entry].slice(-MAX_LOCAL_SESSIONS),
        }))

        const userId = getCurrentUserId()
        if (userId) {
          insertSession(userId, entry).catch(console.error)
          upsertUserXP(userId, newXP).catch(console.error)
        }

        return { xp, leveledUp, newLevel }
      },

      _importFromSupabase(xp) {
        set(state => ({ totalXP: Math.max(state.totalXP, xp) }))
      },

      _reset() {
        set({ totalXP: 0, sessions: [] })
      },
    }),
    {
      name:    'notebook-xp',
      version: 1,
      partialize: (state): Partial<XPState> => ({
        totalXP:  state.totalXP,
        sessions: state.sessions,
      }),
    }
  )
)

export default useXPStore
