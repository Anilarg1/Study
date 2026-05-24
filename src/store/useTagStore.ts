import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { fetchTags, createTag, removeTag } from '../lib/supabase'
import { getCurrentUserId } from '../lib/currentUser'
import type { Tag } from '../types'

interface TagState {
  tags: Tag[]

  addTag(name: string): Promise<Tag | null>
  deleteTag(id: string): Promise<void>
  _importFromSupabase(tags: Tag[]): void
  _reset(): void
}

const useTagStore = create<TagState>()(
  persist(
    (set, get) => ({
      tags: [],

      async addTag(name) {
        const userId = getCurrentUserId()
        if (!userId) return null

        // Deduplicate: if a tag with the same name already exists, return it
        const existing = get().tags.find(
          t => t.name.toLowerCase() === name.toLowerCase()
        )
        if (existing) return existing

        const { data, error } = await createTag(userId, { name })
        if (error || !data) return null
        set(state => ({ tags: [...state.tags, data] }))
        return data
      },

      async deleteTag(id) {
        const userId = getCurrentUserId()
        if (!userId) return
        await removeTag(id)
        set(state => ({ tags: state.tags.filter(t => t.id !== id) }))
      },

      _importFromSupabase(tags) {
        set({ tags })
      },

      _reset() {
        set({ tags: [] })
      },
    }),
    {
      name:    'notebook-tags',
      version: 1,
      partialize: (state): Partial<TagState> => ({ tags: state.tags }),
    }
  )
)

export default useTagStore
