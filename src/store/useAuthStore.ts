import { create } from 'zustand'
import type { User, AuthError } from '@supabase/supabase-js'
import { supabase, fetchUserXP, fetchLoginDates, fetchSubjects, fetchTags, fetchSessions, fetchSubjectXP } from '../lib/supabase'
import { setCurrentUserId } from '../lib/currentUser'
import useXPStore          from './useXPStore'
import useStreakStore       from './useStreakStore'
import useSubjectStore     from './useSubjectStore'
import useTagStore         from './useTagStore'
import useSubjectMasteryStore from './useSubjectMasteryStore'
import useSettingsStore    from './useSettingsStore'
import useGoalsStore       from './useGoalsStore'
import type { SessionEntry, TimerMode } from '../types'

// Tracks the active Supabase auth subscription so init() can dedup it.
let _authSub: { unsubscribe: () => void } | null = null

// Tracks the active realtime channel so we can clean up on sign-out.
let _sessionChannel: ReturnType<typeof supabase.channel> | null = null

function mapRowToSessionEntry(row: Record<string, unknown>): SessionEntry {
  return {
    id:           row.id           as string,
    type:         row.type         as TimerMode,
    completedAt:  row.completed_at as string,
    xp:           row.xp           as number,
    subjectId:    row.subject_id   as string | null,
    tagId:        row.tag_id       as string | null,
    durationSecs: row.duration_secs as number | null,
  }
}

interface AuthState {
  user:    User | null
  loading: boolean

  init(): Promise<void>
  signUp(email: string, password: string): Promise<AuthError | null>
  signIn(email: string, password: string): Promise<AuthError | null>
  signOut(): Promise<void>
  _syncFromSupabase(userId: string): Promise<void>
  _subscribeRealtime(userId: string): void
  _unsubscribeRealtime(): void
}

const useAuthStore = create<AuthState>()((set, get) => ({
  user:    null,
  loading: true,

  async init() {
    // Cancel any previously-registered listener before creating a new one.
    // This prevents React StrictMode from stacking two listeners in development.
    _authSub?.unsubscribe()
    _authSub = null

    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        set({ user: session.user })
        setCurrentUserId(session.user.id)
        await get()._syncFromSupabase(session.user.id)
        useStreakStore.getState().clockIn()
        get()._subscribeRealtime(session.user.id)
      }
    } catch (err) {
      console.error('[auth] init failed:', err)
    } finally {
      set({ loading: false })
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user ?? null

      if (event === 'SIGNED_IN' && user) {
        set({ user })
        setCurrentUserId(user.id)
        await get()._syncFromSupabase(user.id)
        useStreakStore.getState().clockIn()
        get()._subscribeRealtime(user.id)
      }

      if (event === 'USER_UPDATED' && user) {
        set({ user })
      }

      if (event === 'SIGNED_OUT') {
        set({ user: null })
        get()._unsubscribeRealtime()
      }
    })

    _authSub = subscription
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
    get()._unsubscribeRealtime()
    useXPStore.getState()._reset()
    useStreakStore.getState()._reset()
    useSubjectStore.getState()._reset()
    useTagStore.getState()._reset()
    useSubjectMasteryStore.getState()._reset()
    useGoalsStore.getState()._reset()
    await supabase.auth.signOut()
  },

  async _syncFromSupabase(userId) {
    const [xpResult, datesResult, subjectsResult, tagsResult, sessionsResult, subjectXPResult, prefsResult] = await Promise.all([
      fetchUserXP(userId),
      fetchLoginDates(userId),
      fetchSubjects(userId),
      fetchTags(userId),
      fetchSessions(userId, { limit: 2000 }),
      fetchSubjectXP(userId),
      supabase.from('user_prefs').select('prefs').eq('user_id', userId).maybeSingle(),
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
    if (tagsResult.data) {
      useTagStore.getState()._importFromSupabase(tagsResult.data)
    }
    if (sessionsResult.data.length > 0) {
      useXPStore.getState()._setLoading(true)
      await useXPStore.getState()._importSessionsFromSupabase(sessionsResult.data)
    }
    if (subjectXPResult.data.length > 0) {
      useSubjectMasteryStore.getState()._importFromSupabase(subjectXPResult.data)
    }
    if (prefsResult.data?.prefs) {
      useSettingsStore.getState()._importFromSupabase(prefsResult.data.prefs)
    }
    await useGoalsStore.getState().fetchGoals(userId)
  },

  _subscribeRealtime(userId) {
    // Clean up any previous channel before creating a new one
    get()._unsubscribeRealtime()

    _sessionChannel = supabase
      .channel('realtime:sessions')
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'sessions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = mapRowToSessionEntry(payload.new as Record<string, unknown>)
          useXPStore.getState()._mergeSession(incoming)
        },
      )
      .subscribe()
  },

  _unsubscribeRealtime() {
    if (_sessionChannel) {
      supabase.removeChannel(_sessionChannel)
      _sessionChannel = null
    }
  },
}))

export default useAuthStore
