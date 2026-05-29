import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Theme, Density, TimeFormat, WeekStart, FontScale } from '../types'
import { supabase } from '../lib/supabase'

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

// Keys excluded from Supabase sync (per-device preferences)
const LOCAL_ONLY_KEYS = new Set<keyof SettingsData>(['sidebarCollapsed', 'focusMode'])

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
  focusMode:         boolean
  soundVolume:       number
  autoStartBreaks:   boolean
  autoStartFocus:    boolean
  dailySessionGoal:  number
}

type BooleanSettingsKey = {
  [K in keyof SettingsData]: SettingsData[K] extends boolean ? K : never
}[keyof SettingsData]

interface SettingsState extends SettingsData {
  setField<K extends keyof SettingsData>(key: K, value: SettingsData[K]): void
  toggle(key: BooleanSettingsKey): void
  _importFromSupabase(prefs: Partial<SettingsData>): void
  _syncToSupabase(userId: string): void
}

// ── Debounce helper ───────────────────────────────────────────────────────────

let _syncTimer: ReturnType<typeof setTimeout> | null = null

function debouncedSync(userId: string, getState: () => SettingsState) {
  if (_syncTimer) clearTimeout(_syncTimer)
  _syncTimer = setTimeout(() => {
    _syncTimer = null
    const s = getState()
    const prefs: Partial<SettingsData> = {}
    const keys = Object.keys(s) as (keyof SettingsData)[]
    for (const k of keys) {
      if (LOCAL_ONLY_KEYS.has(k)) continue
      if (typeof s[k] === 'function') continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(prefs as any)[k] = s[k]
    }
    supabase
      .from('user_prefs')
      .upsert({ user_id: userId, prefs, updated_at: new Date().toISOString() })
      .then(({ error }) => { if (error) console.error('[settings] sync error', error) })
  }, 1000)
}

// ── Store ─────────────────────────────────────────────────────────────────────

const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
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
      focusMode:        false,
      soundVolume:      80,
      autoStartBreaks:  false,
      autoStartFocus:   false,
      dailySessionGoal: 4,

      // ── Actions ──────────────────────────────────────────────────────────
      setField: (key, value) => set({ [key]: value } as Partial<SettingsState>),
      toggle:   (key)        => set(s => ({ [key]: !s[key] } as Partial<SettingsState>)),

      // ── Supabase sync ─────────────────────────────────────────────────────
      _importFromSupabase(prefs) {
        // Remote wins for all synced fields; local-only keys are left untouched
        const patch: Partial<SettingsData> = {}
        for (const [k, v] of Object.entries(prefs) as [keyof SettingsData, unknown][]) {
          if (!LOCAL_ONLY_KEYS.has(k) && v !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(patch as any)[k] = v
          }
        }
        set(patch as Partial<SettingsState>)
        // Apply visual side effects
        if (patch.theme)       applyTheme(patch.theme as Theme)
        if (patch.density)     applyDensity(patch.density as Density)
        if (patch.fontScale)   applyFontScale(patch.fontScale as FontScale)
        if (patch.highContrast !== undefined) applyContrast(patch.highContrast as boolean)
      },

      _syncToSupabase(userId) {
        debouncedSync(userId, get)
      },
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
        focusMode:        state.focusMode,
        soundVolume:      state.soundVolume,
        autoStartBreaks:  state.autoStartBreaks,
        autoStartFocus:   state.autoStartFocus,
        dailySessionGoal: state.dailySessionGoal,
      }),
    }
  )
)

export default useSettingsStore
