import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TimerMode, TimerDurations } from '../types'

// Default durations in seconds
export const DEFAULT_DURATIONS: TimerDurations = {
  work:       25 * 60,
  shortBreak:  5 * 60,
  longBreak:  15 * 60,
}

// Keep exporting DURATIONS as an alias so existing imports don't break
export const DURATIONS = DEFAULT_DURATIONS

// After this many work sessions, take a long break
const LONG_BREAK_INTERVAL = 4

interface TimerState {
  mode:            TimerMode
  remaining:       number
  running:         boolean
  hasStarted:      boolean
  completedWork:   number
  expiresAt:       string | null
  subjectId:       string | null
  tagId:           string | null
  customDurations: TimerDurations

  start(): void
  pause(): void
  reset(): void
  setMode(mode: TimerMode): void
  setSubjectId(id: string | null): void
  setTagId(id: string | null): void
  setDuration(mode: TimerMode, minutes: number): void
  tick(): boolean
  skip(): void
  _calcRemaining(): number
  _advance(): void
}

const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      mode:            'work',
      remaining:       DEFAULT_DURATIONS.work,
      running:         false,
      hasStarted:      false,
      completedWork:   0,
      expiresAt:       null,
      subjectId:       null,
      tagId:           null,
      customDurations: { ...DEFAULT_DURATIONS },

      start() {
        const { remaining } = get()
        set({
          running:    true,
          hasStarted: true,
          expiresAt:  new Date(Date.now() + remaining * 1000).toISOString(),
        })
      },

      pause() {
        const remaining = get()._calcRemaining()
        set({ running: false, remaining, expiresAt: null })
      },

      reset() {
        const { mode, customDurations } = get()
        set({ running: false, hasStarted: false, remaining: customDurations[mode], expiresAt: null })
      },

      setMode(mode) {
        const { customDurations } = get()
        set({ mode, running: false, remaining: customDurations[mode], expiresAt: null })
      },

      setSubjectId(id) {
        set({ subjectId: id })
      },

      setTagId(id) {
        set({ tagId: id })
      },

      setDuration(mode, minutes) {
        const secs = Math.max(1, Math.round(minutes)) * 60
        const { mode: currentMode, running, customDurations } = get()
        const newDurations = { ...customDurations, [mode]: secs }
        const updates: Partial<TimerState> = { customDurations: newDurations }
        if (mode === currentMode && !running) {
          updates.remaining = secs
          updates.expiresAt = null
        }
        set(updates)
      },

      tick() {
        if (!get().running) return false
        const remaining = get()._calcRemaining()
        if (remaining > 0) {
          set({ remaining })
          return false
        }
        get()._advance()
        return true
      },

      _calcRemaining() {
        const { expiresAt } = get()
        if (!expiresAt) return 0
        return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000))
      },

      _advance() {
        const { mode, completedWork, customDurations } = get()
        let nextMode: TimerMode
        let newCompleted: number

        if (mode === 'work') {
          newCompleted = completedWork + 1
          nextMode = newCompleted % LONG_BREAK_INTERVAL === 0
            ? 'longBreak'
            : 'shortBreak'
        } else {
          newCompleted = completedWork
          nextMode = 'work'
        }

        set({
          mode:          nextMode,
          remaining:     customDurations[nextMode],
          running:       false,
          expiresAt:     null,
          completedWork: newCompleted,
        })
      },

      skip() {
        get()._advance()
      },
    }),
    {
      name:    'notebook-timer',
      version: 3,
      partialize: (state): Partial<TimerState> => ({
        mode:            state.mode,
        remaining:       state.running ? state._calcRemaining() : state.remaining,
        running:         state.running,
        hasStarted:      state.hasStarted,
        completedWork:   state.completedWork,
        expiresAt:       state.expiresAt,
        subjectId:       state.subjectId,
        tagId:           state.tagId,
        customDurations: state.customDurations,
      }),
    }
  )
)

export default useTimerStore
