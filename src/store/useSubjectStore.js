import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { fetchSubjects, createSubject, patchSubject, removeSubject } from '../lib/supabase'

const useSubjectStore = create(
  persist(
    (set, get) => ({
      subjects: [],    // [{ id, name, color, created_at }]
      activeId: null,  // subject id currently selected in the timer

      /** Select a subject (or null to clear). */
      setActiveId(id) {
        set({ activeId: id })
      },

      /**
       * Create a new subject in Supabase and add it locally.
       * Returns the new subject object, or null on error.
       */
      async addSubject(name, color) {
        const { data: { session } } = await supabase.auth.getSession()
        const userId = session?.user?.id
        if (!userId) return null

        const { data, error } = await createSubject(userId, { name, color })
        if (error || !data) { console.error(error); return null }

        set(state => ({ subjects: [...state.subjects, data] }))
        return data
      },

      /** Update a subject's name/color both locally and in Supabase. */
      async editSubject(id, updates) {
        const error = await patchSubject(id, updates)
        if (error) { console.error(error); return }
        set(state => ({
          subjects: state.subjects.map(s => s.id === id ? { ...s, ...updates } : s),
        }))
      },

      /** Delete a subject and clear it from the active selection if needed. */
      async deleteSubject(id) {
        const error = await removeSubject(id)
        if (error) { console.error(error); return }
        set(state => ({
          subjects: state.subjects.filter(s => s.id !== id),
          activeId: state.activeId === id ? null : state.activeId,
        }))
      },

      // ── Auth hooks ────────────────────────────────────────────────────────────

      /** Called by useAuthStore after sign-in to hydrate from Supabase. */
      _importFromSupabase(subjects) {
        set({ subjects })
      },

      /** Called by useAuthStore on sign-out. */
      _reset() {
        set({ subjects: [], activeId: null })
      },
    }),
    {
      name:    'notebook-subjects',
      version: 1,
      partialize: state => ({
        subjects: state.subjects,
        activeId: state.activeId,
      }),
    }
  )
)

export default useSubjectStore
