import { create } from 'zustand'
import type { Assessment } from '../types'
import { getCurrentUserId } from '../lib/currentUser'
import {
  fetchAssessments,
  createAssessment as createAssessmentDB,
  deleteAssessment as deleteAssessmentDB,
} from '../lib/supabase'

interface AssessmentState {
  assessments:    Assessment[]
  isLoading:      boolean
  loadForSubject(subjectId: string):                                        Promise<void>
  addAssessment(a: Omit<Assessment, 'id' | 'created_at' | 'percentage'>): Promise<void>
  removeAssessment(id: string):                                             Promise<void>
  _reset():                                                                  void
}

const useAssessmentStore = create<AssessmentState>()((set) => ({
  assessments: [],
  isLoading:   false,

  async loadForSubject(subjectId) {
    const userId = getCurrentUserId()
    if (!userId) return
    set({ isLoading: true })
    const { data, error } = await fetchAssessments(userId, subjectId)
    if (error) { console.error(error); set({ isLoading: false }); return }
    set({ assessments: data, isLoading: false })
  },

  async addAssessment(a) {
    const userId = getCurrentUserId()
    if (!userId) return
    const { data, error } = await createAssessmentDB(userId, a)
    if (error || !data) { console.error(error); return }
    set(s => ({ assessments: [data, ...s.assessments] }))
  },

  async removeAssessment(id) {
    const error = await deleteAssessmentDB(id)
    if (error) { console.error(error); return }
    set(s => ({ assessments: s.assessments.filter(a => a.id !== id) }))
  },

  _reset() {
    set({ assessments: [], isLoading: false })
  },
}))

export default useAssessmentStore
