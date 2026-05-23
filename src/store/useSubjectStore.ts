import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { fetchSubjects, createSubject, patchSubject, removeSubject } from '../lib/supabase'
import { getCurrentUserId } from '../lib/currentUser'
import type { Subject } from '../types'

interface SubjectState {
  subjects: Subject[]
  activeId: string | null

  setActiveId(id: string | null): void
  addSubject(name: string, color: string): Promise<Subject | null>
  editSubject(id: string, updates: Partial<Pick<Subject, 'name' | 'color'>>): Promise<void>
  deleteSubject(id: string): Promise<void>
  _importFromSupabase(subjects: Subject[]): void
  _reset(): void
}

const useSubjectStore = create<SubjectState>()(
  persist(
    (set) => ({
      subjects: [],
      activeId: null,

      setActiveId(id) {
        set({ activeId: id })
      },

      async addSubject(name, color) {
        const userId = getCurrentUserId()
        if (!userId) return null

        const { data, error } = await createSubject(userId, { name, color })
        if (error || !data) { console.error(error); return null }

        set(state => ({ subjects: [...state.subjects, data] }))
        return data
      },

      async editSubject(id, updates) {
        const error = await patchSubject(id, updates)
        if (error) { console.error(error); return }
        set(state => ({
          subjects: state.subjects.map(s => s.id === id ? { ...s, ...updates } : s),
        }))
      },

      async deleteSubject(id) {
        const error = await removeSubject(id)
        if (error) { console.error(error); return }
        set(state => ({
          subjects: state.subjects.filter(s => s.id !== id),
          activeId: state.activeId === id ? null : state.activeId,
        }))
      },

      _importFromSupabase(subjects) {
        set({ subjects })
      },

      _reset() {
        set({ subjects: [], activeId: null })
      },
    }),
    {
      name:    'notebook-subjects',
      version: 1,
      partialize: (state): Partial<SubjectState> => ({
        subjects: state.subjects,
        activeId: state.activeId,
      }),
    }
  )
)

export default useSubjectStore
