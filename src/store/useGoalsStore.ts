import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import useXPStore from './useXPStore'
import useStreakStore, { calcCurrentStreak } from './useStreakStore'
import { xpToLevel } from '../utils/xp'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GoalEntry {
  id:          string
  type:        'monthly_hours' | 'streak' | 'xp_rank' | 'subject_hours'
  targetValue: number
  subjectId:   string | null
  dueDate:     string | null  // ISO date
}

interface GoalsState {
  goals: GoalEntry[]
  fetchGoals(userId: string): Promise<void>
  upsertGoal(goal: Omit<GoalEntry, 'id'> & { id?: string }): Promise<void>
  _reset(): void
}

// ── Default goals seeded on first sign-in ─────────────────────────────────────

function buildDefaults(): Omit<GoalEntry, 'id'>[] {
  const currentStreak = calcCurrentStreak(
    new Set(useStreakStore.getState().loginDates),
  )
  const streakTarget = Math.ceil((currentStreak + 1) / 5) * 5

  return [
    { type: 'monthly_hours', targetValue: 40,          subjectId: null, dueDate: null },
    { type: 'streak',        targetValue: streakTarget, subjectId: null, dueDate: null },
    { type: 'xp_rank',       targetValue: xpToLevel(useXPStore.getState().totalXP) + 1, subjectId: null, dueDate: null },
  ]
}

// ── Store ─────────────────────────────────────────────────────────────────────

const useGoalsStore = create<GoalsState>()((set) => ({
  goals: [],

  async fetchGoals(userId) {
    const { data, error } = await supabase
      .from('goals')
      .select('id, type, target_value, subject_id, due_date')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[goals] fetch error', error)
      return
    }

    if (!data || data.length === 0) {
      // Seed defaults for new users
      const defaults = buildDefaults()
      const { data: inserted, error: insertError } = await supabase
        .from('goals')
        .insert(defaults.map(d => ({
          user_id:      userId,
          type:         d.type,
          target_value: d.targetValue,
          subject_id:   d.subjectId ?? null,
          due_date:     d.dueDate   ?? null,
        })))
        .select('id, type, target_value, subject_id, due_date')

      if (insertError) console.error('[goals] seed error', insertError)
      const rows = inserted ?? []
      set({
        goals: rows.map(r => ({
          id:          r.id          as string,
          type:        r.type        as GoalEntry['type'],
          targetValue: Number(r.target_value),
          subjectId:   r.subject_id  as string | null,
          dueDate:     r.due_date    as string | null,
        })),
      })
      return
    }

    set({
      goals: data.map(r => ({
        id:          r.id          as string,
        type:        r.type        as GoalEntry['type'],
        targetValue: Number(r.target_value),
        subjectId:   r.subject_id  as string | null,
        dueDate:     r.due_date    as string | null,
      })),
    })
  },

  async upsertGoal(goal) {
    const { data: session } = await supabase.auth.getSession()
    const userId = session.session?.user.id
    if (!userId) return

    const { data, error } = await supabase
      .from('goals')
      .upsert({
        ...(goal.id ? { id: goal.id } : {}),
        user_id:      userId,
        type:         goal.type,
        target_value: goal.targetValue,
        subject_id:   goal.subjectId ?? null,
        due_date:     goal.dueDate   ?? null,
      })
      .select('id, type, target_value, subject_id, due_date')
      .single()

    if (error || !data) { console.error('[goals] upsert error', error); return }

    const updated: GoalEntry = {
      id:          data.id          as string,
      type:        data.type        as GoalEntry['type'],
      targetValue: Number(data.target_value),
      subjectId:   data.subject_id  as string | null,
      dueDate:     data.due_date    as string | null,
    }

    set(state => ({
      goals: goal.id
        ? state.goals.map(g => g.id === goal.id ? updated : g)
        : [...state.goals, updated],
    }))
  },

  _reset() {
    set({ goals: [] })
  },
}))

// ── Selector: progress for a single goal (0–1) ───────────────────────────────

export function useGoalProgress(goalId: string): number {
  const goal    = useGoalsStore(s => s.goals.find(g => g.id === goalId))
  const sessions = useXPStore(s => s.sessions)
  const totalXP  = useXPStore(s => s.totalXP)
  const loginDates = useStreakStore(s => s.loginDates)

  if (!goal) return 0

  if (goal.type === 'monthly_hours') {
    const start = new Date()
    start.setDate(1); start.setHours(0, 0, 0, 0)
    const mins = sessions
      .filter(s => s.type === 'work' && new Date(s.completedAt) >= start)
      .reduce((sum, s) => sum + (s.durationSecs ? Math.round(s.durationSecs / 60) : 25), 0)
    return Math.min(1, mins / (goal.targetValue * 60))
  }

  if (goal.type === 'streak') {
    const streak = calcCurrentStreak(new Set(loginDates))
    return Math.min(1, streak / goal.targetValue)
  }

  if (goal.type === 'xp_rank') {
    const level = xpToLevel(totalXP)
    return Math.min(1, level / goal.targetValue)
  }

  if (goal.type === 'subject_hours') {
    const start = new Date()
    start.setDate(1); start.setHours(0, 0, 0, 0)
    const mins = sessions
      .filter(s => s.type === 'work' && s.subjectId === goal.subjectId && new Date(s.completedAt) >= start)
      .reduce((sum, s) => sum + (s.durationSecs ? Math.round(s.durationSecs / 60) : 25), 0)
    return Math.min(1, mins / (goal.targetValue * 60))
  }

  return 0
}

export default useGoalsStore
