import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Default durations in seconds
export const DEFAULT_DURATIONS = {
  work:       25 * 60,
  shortBreak:  5 * 60,
  longBreak:  15 * 60,
}

// Keep exporting DURATIONS as an alias so existing imports don't break
export const DURATIONS = DEFAULT_DURATIONS

// After this many work sessions, take a long break
const LONG_BREAK_INTERVAL = 4

const defaultState = {
  mode:            'work',       // 'work' | 'shortBreak' | 'longBreak'
  remaining:       DEFAULT_DURATIONS.work,
  running:         false,
  completedWork:   0,            // total completed work sessions in this streak
  // Timestamp trick: store when the timer "would" expire so we survive
  // tab closes / re-mounts without a separate setInterval in storage.
  expiresAt:       null,         // ISO string — set when running
  subject:         '',           // optional subject label
  customDurations: { ...DEFAULT_DURATIONS },
}

const useTimerStore = create(
  persist(
    (set, get) => ({
      ...defaultState,

      /** Start (or resume) the timer */
      start() {
        const { remaining } = get()
        set({
          running:   true,
          expiresAt: new Date(Date.now() + remaining * 1000).toISOString(),
        })
      },

      /** Pause — capture how much time is left */
      pause() {
        const remaining = get()._calcRemaining()
        set({ running: false, remaining, expiresAt: null })
      },

      /** Reset to the beginning of the current mode */
      reset() {
        const { mode, customDurations } = get()
        set({ running: false, remaining: customDurations[mode], expiresAt: null })
      },

      /** Switch mode manually (also resets) */
      setMode(mode) {
        const { customDurations } = get()
        set({ mode, running: false, remaining: customDurations[mode], expiresAt: null })
      },

      setSubject(subject) {
        set({ subject })
      },

      /**
       * Update the duration for a given mode (in minutes).
       * If the timer is not running and this is the current mode,
       * the display resets to the new duration immediately.
       */
      setDuration(mode, minutes) {
        const secs = Math.max(1, Math.round(minutes)) * 60
        const { mode: currentMode, running, customDurations } = get()
        const newDurations = { ...customDurations, [mode]: secs }
        const updates = { customDurations: newDurations }
        if (mode === currentMode && !running) {
          updates.remaining = secs
          updates.expiresAt = null
        }
        set(updates)
      },

      /**
       * Called by the UI ticker every second to sync remaining time.
       * Returns true when the session just finished.
       */
      tick() {
        if (!get().running) return false
        const remaining = get()._calcRemaining()
        if (remaining > 0) {
          set({ remaining })
          return false
        }
        // Session finished
        get()._advance()
        return true
      },

      /** Internal: seconds left based on expiresAt */
      _calcRemaining() {
        const { expiresAt } = get()
        if (!expiresAt) return 0
        return Math.max(0, Math.round((new Date(expiresAt) - Date.now()) / 1000))
      },

      /** Internal: move to the next session */
      _advance() {
        const { mode, completedWork, customDurations } = get()
        let nextMode, newCompleted

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

      /** Skip to next session without awarding XP */
      skip() {
        get()._advance()
      },
    }),
    {
      name:    'notebook-timer',
      version: 1,
      // Only persist the raw state we need to survive a reload
      partialize: state => ({
        mode:            state.mode,
        remaining:       state.running ? state._calcRemaining() : state.remaining,
        running:         state.running,
        completedWork:   state.completedWork,
        expiresAt:       state.expiresAt,
        subject:         state.subject,
        customDurations: state.customDurations,
      }),
    }
  )
)

export default useTimerStore
