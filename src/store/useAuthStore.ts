import { create } from 'zustand'
import type { User, AuthError } from '@supabase/supabase-js'
import { supabase, fetchUserXP, fetchLoginDates, fetchSubjects } from '../lib/supabase'
import { setCurrentUserId } from '../lib/currentUser'
import useXPStore      from './useXPStore'
import useStreakStore  from './useStreakStore'
import useSubjectStore from './useSubjectStore'

interface AuthState {
  user:    User | null
  loading: boolean

  init(): Promise<void>
  signUp(email: string, password: string): Promise<AuthError | null>
  signIn(email: string, password: string): Promise<AuthError | null>
  signOut(): Promise<void>
  _syncFromSupabase(userId: string): Promise<void>
}

const useAuthStore = create<AuthState>()((set, get) => ({
  user:    null,
  loading: true,

  async init() {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        set({ user: session.user })
        setCurrentUserId(session.user.id)
        await get()._syncFromSupabase(session.user.id)
        useStreakStore.getState().clockIn()
      }
    } catch (err) {
      console.error('[auth] init failed:', err)
    } finally {
      set({ loading: false })
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user ?? null

      if (event === 'SIGNED_IN' && user) {
        set({ user })
        setCurrentUserId(user.id)
        await get()._syncFromSupabase(user.id)
        useStreakStore.getState().clockIn()
      }

      if (event === 'SIGNED_OUT') {
        set({ user: null })
      }
    })
  },

  async signUp(email, password) {
    const { error } = await supabase.auth.signUp({ email, password })
    return error
  },

  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  },

  async signOut() {
    setCurrentUserId(null)
    useXPStore.getState()._reset()
    useStreakStore.getState()._reset()
    useSubjectStore.getState()._reset()
    await supabase.auth.signOut()
  },

  async _syncFromSupabase(userId) {
    const [xpResult, datesResult, subjectsResult] = await Promise.all([
      fetchUserXP(userId),
      fetchLoginDates(userId),
      fetchSubjects(userId),
    ])

    if (xpResult.data) {
      useXPStore.getState()._importFromSupabase(xpResult.data.xp)
    }
    if (datesResult.data) {
      useStreakStore.getState()._importFromSupabase(datesResult.data)
    }
    if (subjectsResult.data) {
      useSubjectStore.getState()._importFromSupabase(subjectsResult.data)
    }
  },
}))

export default useAuthStore
