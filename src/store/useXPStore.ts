import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { calcSessionXP, getStreakMultiplier, XP_REWARDS } from '../utils/xp'
import { getRankFromXP } from '../utils/progression'
import { insertSession, upsertUserXP } from '../lib/supabase'
import { getCurrentUserId } from '../lib/currentUser'
import useSubjectMasteryStore from './useSubjectMasteryStore'
import useStreakStore, { calcCurrentStreak } from './useStreakStore'
import type { TimerMode, SessionEntry } from '../types'
import type { RankInfo } from '../utils/progression'

// Keep only the most-recent N sessions in localStorage to avoid unbounded growth.
// Supabase is the source of truth — older sessions are loaded via fetchSessions() on login.
// Raise this limit (or migrate to cursor-based Supabase pagination) if users report stats gaps.
const MAX_LOCAL_SESSIONS = 500

export interface AwardResult {
  xp:        number
  leveledUp: boolean   // kept for backward compat — true when rank tier changes
  newLevel:  number    // kept for backward compat — rankIndex of new rank
  rankUp:    { previous: RankInfo; current: RankInfo } | null
}

interface XPState {
  totalXP:  number
  sessions: SessionEntry[]

  awardXP(
    sessionType:   TimerMode,
    subjectId?:    string | null,
    durationSecs?: number | null,
    tagId?:        string | null,
  ): AwardResult
  _importFromSupabase(xp: number): void
  _importSessionsFromSupabase(sessions: SessionEntry[]): void
  _mergeSession(session: SessionEntry): void
  _reset(): void
  isLoading: boolean
  _setLoading(v: boolean): void
}

const useXPStore = create<XPState>()(
  persist(
    (set, get) => ({
      totalXP:  0,
      sessions: [],
      isLoading: false,

      awardXP(sessionType, subjectId = null, durationSecs = null, tagId = null) {
        // ── Calculate XP ──────────────────────────────────────────────────
        let xp: number
        if (sessionType === 'work' && durationSecs != null) {
          const loginDates    = useStreakStore.getState().loginDates
          const streak        = calcCurrentStreak(new Set(loginDates))
          const multiplier    = getStreakMultiplier(streak)
          xp = Math.floor(calcSessionXP(durationSecs) * multiplier)
        } else {
          // break sessions stay flat; work sessions without durationSecs get 0 XP
          xp = XP_REWARDS[sessionType] ?? 0
        }

        // ── Rank before / after ───────────────────────────────────────────
        const prevXP   = get().totalXP
        const newXP    = prevXP + xp
        const prevRank = getRankFromXP(prevXP)
        const newRank  = getRankFromXP(newXP)
        const rankUp   = newRank.rankIndex > prevRank.rankIndex
          ? { previous: prevRank, current: newRank }
          : null

        // ── Update local state ────────────────────────────────────────────
        const entry: SessionEntry = {
          id:           crypto.randomUUID(),
          type:         sessionType,
          completedAt:  new Date().toISOString(),
          xp,
          subjectId:    subjectId    ?? null,
          tagId:        tagId        ?? null,
          durationSecs: durationSecs ?? null,
        }

        set(state => ({
          totalXP:  newXP,
          sessions: [...state.sessions, entry].slice(-MAX_LOCAL_SESSIONS),
        }))

        // ── Award subject mastery (work sessions with a subject only) ─────
        if (sessionType === 'work' && subjectId) {
          useSubjectMasteryStore.getState().addSubjectXP(subjectId, xp)
        }

        // ── Persist to Supabase ───────────────────────────────────────────
        const userId = getCurrentUserId()
        if (userId) {
          insertSession(userId, entry).catch(console.error)
          upsertUserXP(userId, newXP).catch(console.error)
        }

        return {
          xp,
          leveledUp: rankUp !== null && rankUp.current.tierIndex !== rankUp.previous.tierIndex,
          newLevel:  newRank.rankIndex,
          rankUp,
        }
      },

      _importFromSupabase(xp) {
        set(state => ({ totalXP: Math.max(state.totalXP, xp) }))
      },

      _setLoading(v) { set({ isLoading: v }) },

      _importSessionsFromSupabase(sessions) {
        // sessions arrive newest-first from Supabase; reverse to oldest-first to match
        // the append order used by awardXP, then cap at MAX_LOCAL_SESSIONS
        const toStore = [...sessions].reverse().slice(0, MAX_LOCAL_SESSIONS)
        set({ sessions: toStore, isLoading: false })
      },

      _mergeSession(incoming) {
        // Deduplicate: the optimistic write already added this row locally
        set(state => {
          if (state.sessions.some(s => s.id === incoming.id)) return state
          return {
            sessions: [...state.sessions, incoming].slice(-MAX_LOCAL_SESSIONS),
          }
        })
      },

      _reset() {
        set({ totalXP: 0, sessions: [] })
      },
    }),
    {
      name:    'notebook-xp',
      version: 2,   // bumped: formula changed, local XP reset on upgrade
      partialize: (state) => ({
        totalXP:  state.totalXP,
        sessions: state.sessions,
      }),
      migrate: (persistedState: unknown, fromVersion: number) => {
        // v1 → v2: formula changed, preserve totalXP but sessions may have stale XP
        if (fromVersion === 1 && persistedState && typeof persistedState === 'object') {
          const old = persistedState as { totalXP?: number; sessions?: SessionEntry[] }
          return { totalXP: old.totalXP ?? 0, sessions: old.sessions ?? [] }
        }
        return { totalXP: 0, sessions: [] }
      },
    }
  )
)

export default useXPStore
