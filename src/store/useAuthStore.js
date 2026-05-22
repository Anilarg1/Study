import { create } from 'zustand'
import { supabase, fetchUserXP, fetchLoginDates, fetchSubjects } from '../lib/supabase'
import useXPStore      from './useXPStore'
import useStreakStore  from './useStreakStore'
import useSubjectStore from './useSubjectStore'

const useAuthStore = create((set, get) => ({
  user:    null,
  loading: true,   // true until the initial session check resolves

  /**
   * Call once on app mount.
   * Restores any existing session, syncs data from Supabase,
   * then subscribes to future auth state changes.
   */
  async init() {
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user) {
      set({ user: session.user })
      await get()._syncFromSupabase(session.user.id)
      // Clock in *after* Supabase dates are loaded so we don't overwrite them
      useStreakStore.getState().clockIn()
    }

    set({ loading: false })

    // Subscribe to future auth changes (sign-in, sign-out, token refresh)
    supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user ?? null

      if (event === 'SIGNED_IN') {
        set({ user })
        await get()._syncFromSupabase(user.id)
        useStreakStore.getState().clockIn()
      }

      if (event === 'SIGNED_OUT') {
        set({ user: null })
        useXPStore.getState()._reset()
        useStreakStore.getState()._reset()
        useSubjectStore.getState()._reset()
      }
    })
  },

  /** Create a new account. Returns the Supabase error object or null. */
  async signUp(email, password) {
    const { error } = await supabase.auth.signUp({ email, password })
    return error
  },

  /** Sign in with email + password. Returns the Supabase error or null. */
  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  },

  async signOut() {
    await supabase.auth.signOut()
  },

  /**
   * Pull XP and login dates from Supabase and overwrite the local stores.
   * Called right after a session is established.
   */
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
