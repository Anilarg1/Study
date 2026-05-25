import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { upsertSubjectXP } from '../lib/supabase'
import { getCurrentUserId } from '../lib/currentUser'

interface SubjectMasteryState {
  /** Map of subjectId → total XP earned in that subject */
  subjectXP: Record<string, number>

  /**
   * Add XP to a subject's mastery pool.
   * Only call for work sessions with a non-null subjectId.
   */
  addSubjectXP(subjectId: string, xp: number): void

  /** Called on sign-in to hydrate from Supabase. */
  _importFromSupabase(data: { subjectId: string; xp: number }[]): void

  _reset(): void
}

const useSubjectMasteryStore = create<SubjectMasteryState>()(
  persist(
    (set, get) => ({
      subjectXP: {},

      addSubjectXP(subjectId, xp) {
        if (!subjectId || typeof subjectId !== 'string') return
        if (!Number.isInteger(xp) || xp < 0) return
        const prev     = get().subjectXP[subjectId] ?? 0
        const newTotal = prev + xp
        set(state => ({
          subjectXP: { ...state.subjectXP, [subjectId]: newTotal },
        }))
        const userId = getCurrentUserId()
        if (userId) {
          upsertSubjectXP(userId, subjectId, newTotal).catch(console.error)
        }
      },

      _importFromSupabase(data) {
        // Merge Supabase values with local, keeping the higher of the two
        set(state => {
          const merged = { ...state.subjectXP }
          for (const { subjectId, xp } of data) {
            merged[subjectId] = Math.max(merged[subjectId] ?? 0, xp)
          }
          return { subjectXP: merged }
        })
      },

      _reset() {
        set({ subjectXP: {} })
      },
    }),
    {
      name: 'notebook-subject-mastery',
      version: 1,
      partialize: (state): Partial<SubjectMasteryState> => ({
        subjectXP: state.subjectXP,
      }),
    }
  )
)

export default useSubjectMasteryStore
