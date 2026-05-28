// ─── Domain types shared across stores and components ────────────────────────

export type TimerMode  = 'work' | 'shortBreak' | 'longBreak'
export type Theme      = 'dark' | 'light' | 'system'
export type Density    = 'comfortable' | 'compact'
export type TimeFormat = '24h' | '12h'
export type WeekStart  = 'monday' | 'sunday'
export type FontScale  = 100 | 110 | 120

export interface Subject {
  id:           string
  name:         string
  color:        string
  exam_board:   string | null
  target_grade: string | null
  created_at:   string
}

export interface Tag {
  id:         string
  name:       string
  created_at: string
}

export interface SessionEntry {
  id:           string
  type:         TimerMode
  completedAt:  string
  xp:           number
  subjectId:    string | null
  tagId:        string | null
  durationSecs: number | null
}

export interface TimerDurations {
  work:       number
  shortBreak: number
  longBreak:  number
}

export interface SubjectLabel {
  id:   string
  name: string
}

export interface Assessment {
  id:             string
  subject_id:     string
  type:           'past_paper' | 'school_test'
  title:          string
  marks_obtained: number
  marks_total:    number
  sat_on:         string        // ISO date 'YYYY-MM-DD'
  paper_ref:      string | null
  created_at:     string
  percentage:     number        // derived client-side: marks_obtained / marks_total * 100
}

export interface GradeBoundary {
  grade:   string
  min_pct: number
  max_pct: number
}
