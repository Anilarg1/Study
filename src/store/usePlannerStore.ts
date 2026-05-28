import { create } from 'zustand'
import type { Task } from '../types'
import {
  fetchTasks,
  createTask as createTaskDb,
  updateTask as updateTaskDb,
  deleteTask as deleteTaskDb,
} from '../lib/supabase'
import { getMonday, todayISO, nextOccurrence } from '../lib/planner'

interface PlannerState {
  tasks:     Task[]
  isLoading: boolean
  weekStart: string   // ISO date of the current week's Monday

  loadTasks:   (userId: string) => Promise<void>
  createTask:  (t: Omit<Task, 'id' | 'created_at'>) => Promise<void>
  updateTask:  (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask:  (id: string) => Promise<void>
  completeTask:(id: string) => Promise<void>
  setWeekStart:(date: string) => void
  _reset:      () => void
}

export const usePlannerStore = create<PlannerState>()((set, get) => ({
  tasks: [],
  isLoading: false,
  weekStart: getMonday(todayISO()),

  loadTasks: async (userId) => {
    set({ isLoading: true })
    const tasks = await fetchTasks(userId)
    set({ tasks, isLoading: false })
  },

  updateTask: async (id, updates) => {
    const prev = get().tasks
    set({ tasks: prev.map((t) => (t.id === id ? { ...t, ...updates } : t)) })
    try {
      await updateTaskDb(id, updates)
    } catch (e) {
      console.error(e)
      set({ tasks: prev })   // rollback
    }
  },

  deleteTask: async (id) => {
    const prev = get().tasks
    set({ tasks: prev.filter((t) => t.id !== id) })
    try {
      await deleteTaskDb(id)
    } catch (e) {
      console.error(e)
      set({ tasks: prev })   // rollback
    }
  },

  completeTask: async (id) => {
    const task = get().tasks.find((t) => t.id === id)
    if (!task) return
    const completedAt = new Date().toISOString()

    // optimistic complete
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, completed_at: completedAt } : t)),
    }))
    await updateTaskDb(id, { completed_at: completedAt })

    // recurring: spawn the next occurrence
    if (task.is_recurring && task.recurrence) {
      const next: Omit<Task, 'id' | 'created_at'> = {
        user_id:      task.user_id,
        subject_id:   task.subject_id,
        title:        task.title,
        notes:        task.notes,
        due_date:     nextOccurrence(task.due_date, task.recurrence),
        due_time:     task.due_time,
        priority:     task.priority,
        is_recurring: true,
        recurrence:   task.recurrence,
        completed_at: null,
      }
      try {
        const saved = await createTaskDb(next)
        if (saved) set((s) => ({ tasks: [...s.tasks, saved] }))
      } catch (e) {
        console.error('[planner] failed to spawn next recurrence', e)
      }
    }
  },

  createTask: async (t) => {
    const saved = await createTaskDb(t)
    if (!saved) { console.error('[planner] createTask: insert failed'); return }
    set((s) => ({ tasks: [...s.tasks, saved] }))
  },

  setWeekStart: (date) => set({ weekStart: getMonday(date) }),

  _reset: () => set({ tasks: [], isLoading: false, weekStart: getMonday(todayISO()) }),
}))
