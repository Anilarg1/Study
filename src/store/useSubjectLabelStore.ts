import { create } from 'zustand'
import type { SubjectLabel } from '../types'
import { getCurrentUserId } from '../lib/currentUser'
import {
  fetchSubjectLabels,
  createSubjectLabel,
  deleteSubjectLabel as deleteSubjectLabelDB,
  fetchSubjectLabelMap,
  setSubjectLabels as setSubjectLabelsDB,
} from '../lib/supabase'

interface SubjectLabelState {
  labels:           SubjectLabel[]
  subjectLabelMap:  Record<string, string[]>  // subject_id → label_id[]
  isLoading:        boolean
  loadLabels():                                              Promise<void>
  loadSubjectLabelMap(subjectIds: string[]):                Promise<void>
  createLabel(name: string):                                Promise<SubjectLabel | null>
  deleteLabel(id: string):                                  Promise<void>
  setSubjectLabels(subjectId: string, labelIds: string[]): Promise<void>
  _reset():                                                  void
}

const useSubjectLabelStore = create<SubjectLabelState>()((set) => ({
  labels:          [],
  subjectLabelMap: {},
  isLoading:       false,

  async loadLabels() {
    const userId = getCurrentUserId()
    if (!userId) return
    set({ isLoading: true })
    const { data, error } = await fetchSubjectLabels(userId)
    if (error) { console.error(error); set({ isLoading: false }); return }
    set({ labels: data, isLoading: false })
  },

  async loadSubjectLabelMap(subjectIds) {
    const { data, error } = await fetchSubjectLabelMap(subjectIds)
    if (error) { console.error(error); return }
    const map: Record<string, string[]> = {}
    for (const { subject_id, label_id } of data) {
      if (!map[subject_id]) map[subject_id] = []
      map[subject_id].push(label_id)
    }
    set({ subjectLabelMap: map })
  },

  async createLabel(name) {
    const userId = getCurrentUserId()
    if (!userId) return null
    const { data, error } = await createSubjectLabel(userId, name)
    if (error || !data) { console.error(error); return null }
    set(s => ({ labels: [...s.labels, data] }))
    return data
  },

  async deleteLabel(id) {
    const error = await deleteSubjectLabelDB(id)
    if (error) { console.error(error); return }
    set(s => ({
      labels: s.labels.filter(l => l.id !== id),
      subjectLabelMap: Object.fromEntries(
        Object.entries(s.subjectLabelMap).map(([sid, ids]) => [sid, ids.filter(i => i !== id)])
      ),
    }))
  },

  async setSubjectLabels(subjectId, labelIds) {
    const error = await setSubjectLabelsDB(subjectId, labelIds)
    if (error) { console.error(error); return }
    set(s => ({ subjectLabelMap: { ...s.subjectLabelMap, [subjectId]: labelIds } }))
  },

  _reset() {
    set({ labels: [], subjectLabelMap: {}, isLoading: false })
  },
}))

export default useSubjectLabelStore
