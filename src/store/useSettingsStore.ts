import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Theme, Density, TimeFormat, WeekStart, FontScale } from '../types'

// ── DOM apply helpers (exported so Settings.tsx can import them) ──────────────

export function applyTheme(theme: Theme): void {
  const mq     = window.matchMedia('(prefers-color-scheme: dark)')
  const isDark = theme === 'dark' || (theme === 'system' && mq.matches)
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
}

export function applyDensity(density: Density): void {
  document.documentElement.setAttribute('data-density', density)
}

export function applyFontScale(scale: FontScale): void {
  const map: Record<FontScale, string> = { 100: '13px', 110: '14px', 120: '15px' }
  document.documentElement.style.fontSize = map[scale] ?? '13px'
}

export function applyContrast(high: boolean): void {
  document.documentElement.setAttribute('data-contrast', high ? 'high' : '')
}

// ── Boot helper: call once before React renders to avoid flash ────────────────

export function bootSettings(): void {
  try {
    const raw = localStorage.getItem('notebook-settings')
    if (!raw) return
    const s = JSON.parse(raw)?.state
    if (!s) return
    applyTheme(s.theme        ?? 'dark')
    applyDensity(s.density    ?? 'comfortable')
    applyFontScale(s.fontScale ?? 100)
    applyContrast(s.highContrast ?? false)
  } catch {
    // corrupt storage — silently ignore
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SettingsData {
  theme:             Theme
  density:           Density
  language:          string
  timeFormat:        TimeFormat
  weekStart:         WeekStart
  fontScale:         FontScale
  highContrast:      boolean
  sidebarCollapsed:  boolean
  soundEnabled:      boolean
  pushEnabled:       boolean
  emailDigest:       boolean
  desktopAlerts:     boolean
  notifyMentions:    boolean
  notifyDueDates:    boolean
  notifyDailyRecap:  boolean
  dndEnabled:        boolean
  dndStart:          string
  dndEnd:            string
}

type BooleanSettingsKey = {
  [K in keyof SettingsData]: SettingsData[K] extends boolean ? K : never
}[keyof SettingsData]

interface SettingsState extends SettingsData {
  setField<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void
  toggle(key: BooleanSettingsKey): void
}

// ── Store ─────────────────────────────────────────────────────────────────────

const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // ── Interface ───────────────────────────────────────────────────────
      theme:            'dark',
      density:          'comfortable',
      language:         'en',
      timeFormat:       '24h',
      weekStart:        'monday',
      fontScale:        100,
      highContrast:     false,
      sidebarCollapsed: false,

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
      setField: (key, value) => set({ [key]: value } as Partial<SettingsState>),
      toggle:   (key)        => set(s => ({ [key]: !s[key] } as Partial<SettingsState>)),
    }),
    {
      name: 'notebook-settings',
      partialize: (state): Partial<SettingsState> => ({
        theme: state.theme, density: state.density, language: state.language,
        timeFormat: state.timeFormat, weekStart: state.weekStart,
        fontScale: state.fontScale, highContrast: state.highContrast,
        sidebarCollapsed: state.sidebarCollapsed,
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
