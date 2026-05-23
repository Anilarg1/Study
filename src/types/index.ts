// ─── Domain types shared across stores and components ────────────────────────

export type TimerMode  = 'work' | 'shortBreak' | 'longBreak'
export type Theme      = 'dark' | 'light' | 'system'
export type Density    = 'comfortable' | 'compact'
export type TimeFormat = '24h' | '12h'
export type WeekStart  = 'monday' | 'sunday'
export type FontScale  = 100 | 110 | 120

export interface Subject {
  id:         string
  name:       string
  color:      string
  created_at: string
}

export interface SessionEntry {
  id:           string
  type:         TimerMode
  completedAt:  string
  xp:           number
  subjectId:    string | null
  durationSecs: number | null
}

export interface TimerDurations {
  work:       number
  shortBreak: number
  longBreak:  number
}
