import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ── DOM apply helpers (exported so Settings.jsx can import them) ──────────────

export function applyTheme(theme) {
  const mq     = window.matchMedia('(prefers-color-scheme: dark)')
  const isDark = theme === 'dark' || (theme === 'system' && mq.matches)
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
}

export function applyDensity(density) {
  document.documentElement.setAttribute('data-density', density)
}

export function applyFontScale(scale) {
  const map = { 100: '13px', 110: '14px', 120: '15px' }
  document.documentElement.style.fontSize = map[scale] ?? '13px'
}

export function applyContrast(high) {
  document.documentElement.setAttribute('data-contrast', high ? 'high' : '')
}

// ── Boot helper: call once before React renders to avoid flash ────────────────

export function bootSettings() {
  try {
    const raw = localStorage.getItem('notebook-settings')
    if (!raw) return
    const s = JSON.parse(raw)?.state
    if (!s) return
    applyTheme(s.theme       ?? 'dark')
    applyDensity(s.density   ?? 'comfortable')
    applyFontScale(s.fontScale ?? 100)
    applyContrast(s.highContrast ?? false)
  } catch {
    // corrupt storage — silently ignore
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

const useSettingsStore = create(
  persist(
    (set) => ({
      // ── Interface ───────────────────────────────────────────────────────
      theme:        'dark',        // 'dark' | 'light' | 'system'
      density:      'comfortable', // 'comfortable' | 'compact'
      language:     'en',
      timeFormat:   '24h',         // '24h' | '12h'
      weekStart:    'monday',      // 'monday' | 'sunday'
      fontScale:    100,           // 100 | 110 | 120
      highContrast: false,

      // ── Notifications ────────────────────────────────────────────────────
      soundEnabled:     true,
      pushEnabled:      false,
      emailDigest:      true,
      desktopAlerts:    false,
      notifyMentions:   true,
      notifyDueDates:   true,
      notifyDailyRecap: false,
      dndEnabled:       false,
      dndStart:         '22:00',
      dndEnd:           '08:00',

      // ── Actions ──────────────────────────────────────────────────────────
      setField: (key, value) => set({ [key]: value }),
      toggle:   (key)        => set(s => ({ [key]: !s[key] })),
    }),
    {
      name: 'notebook-settings',
      partialize: state => ({
        theme: state.theme, density: state.density, language: state.language,
        timeFormat: state.timeFormat, weekStart: state.weekStart,
        fontScale: state.fontScale, highContrast: state.highContrast,
        soundEnabled: state.soundEnabled,
        pushEnabled: state.pushEnabled, emailDigest: state.emailDigest,
        desktopAlerts: state.desktopAlerts, notifyMentions: state.notifyMentions,
        notifyDueDates: state.notifyDueDates, notifyDailyRecap: state.notifyDailyRecap,
        dndEnabled: state.dndEnabled, dndStart: state.dndStart, dndEnd: state.dndEnd,
      }),
    }
  )
)

export default useSettingsStore
