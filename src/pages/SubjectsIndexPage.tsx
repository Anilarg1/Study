import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import useSubjectStore from '../store/useSubjectStore'
import useSubjectLabelStore from '../store/useSubjectLabelStore'
import useSubjectMasteryStore from '../store/useSubjectMasteryStore'
import { getCurrentUserId } from '../lib/currentUser'
import { fetchAllAssessments, fetchGradeBoundaries } from '../lib/supabase'
import { calcProficiency, DEFAULT_BOUNDARIES } from '../utils/proficiency'
import type { Subject, GradeBoundary } from '../types'
import SubjectCard from '../components/subjects/SubjectCard'
import SubjectEditModal from '../components/subjects/SubjectEditModal'

export default function SubjectsIndexPage() {
  const navigate      = useNavigate()
  const subjects      = useSubjectStore(s => s.subjects)
  const deleteSubject = useSubjectStore(s => s.deleteSubject)
  const subjectXP     = useSubjectMasteryStore(s => s.subjectXP)

  const labels              = useSubjectLabelStore(s => s.labels)
  const subjectLabelMap     = useSubjectLabelStore(s => s.subjectLabelMap)
  const loadLabels          = useSubjectLabelStore(s => s.loadLabels)
  const loadSubjectLabelMap = useSubjectLabelStore(s => s.loadSubjectLabelMap)

  const [proficiencyMap, setProficiencyMap] = useState<Record<string, number | null>>({})
  const [boundaryMap,    setBoundaryMap]    = useState<Record<string, GradeBoundary[]>>({})
  const [editMode,       setEditMode]       = useState(false)
  const [filterLabelId,  setFilterLabelId]  = useState<string | null>(null)
  const [modalSubject,   setModalSubject]   = useState<'new' | string | null>(null)
  const [deleteTarget,   setDeleteTarget]   = useState<string | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')

  useEffect(() => { loadLabels() }, [loadLabels])

  useEffect(() => {
    if (subjects.length > 0) {
      loadSubjectLabelMap(subjects.map(s => s.id))
    }
  }, [subjects, loadSubjectLabelMap])

  useEffect(() => {
    const userId = getCurrentUserId()
    if (!userId || subjects.length === 0) return

    fetchAllAssessments(userId).then(({ data }) => {
      const map: Record<string, number | null> = {}
      for (const s of subjects) {
        map[s.id] = calcProficiency(data.filter(a => a.subject_id === s.id))
      }
      setProficiencyMap(map)
    })

    Promise.all(
      subjects.map(s =>
        fetchGradeBoundaries(userId, s.id).then(({ data }) => ({
          id: s.id,
          boundaries: data.length > 0 ? data : DEFAULT_BOUNDARIES,
        }))
      )
    ).then(results => {
      const map: Record<string, GradeBoundary[]> = {}
      for (const { id, boundaries } of results) map[id] = boundaries
      setBoundaryMap(map)
    })
  }, [subjects])

  const filteredSubjects = useMemo(() => {
    if (!filterLabelId) return subjects
    return subjects.filter(s => (subjectLabelMap[s.id] ?? []).includes(filterLabelId))
  }, [subjects, subjectLabelMap, filterLabelId])

  const editingSubject: Subject | null = modalSubject && modalSubject !== 'new'
    ? subjects.find(s => s.id === modalSubject) ?? null
    : null

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    deleteSubject(deleteTarget)
    setDeleteTarget(null)
    setDeleteConfirmName('')
  }

  return (
    <div className="subjects-page">
      <div className="subjects-header">
        <h1 className="subjects-title">Your Subjects</h1>
        <div className="subjects-header-actions">
          <button
            className={`btn-edit-mode${editMode ? ' active' : ''}`}
            onClick={() => setEditMode(m => !m)}
          >
            {editMode ? '✓ Done' : 'Edit'}
          </button>
          <button className="btn-new-subject" onClick={() => setModalSubject('new')}>
            + New subject
          </button>
        </div>
      </div>

      {labels.length > 0 && (
        <div className="subjects-filter-bar">
          <button
            className={`filter-chip${!filterLabelId ? ' active' : ''}`}
            onClick={() => setFilterLabelId(null)}
          >
            All
          </button>
          {labels.map(l => (
            <button
              key={l.id}
              className={`filter-chip${filterLabelId === l.id ? ' active' : ''}`}
              onClick={() => setFilterLabelId(filterLabelId === l.id ? null : l.id)}
            >
              {l.name}
            </button>
          ))}
        </div>
      )}

      {!editMode && filteredSubjects.length > 0 && (
        <div className="s-col-header">
          <div style={{ width: 11 }} />
          <div style={{ minWidth: 100 }}>Subject</div>
          <div style={{ flex: 1 }} />
          <div style={{ minWidth: 200 }}>Proficiency</div>
          <div style={{ minWidth: 24, textAlign: 'center' }}>Grade</div>
          <div style={{ minWidth: 100, textAlign: 'right' }}>vs Target</div>
          <div style={{ width: 18 }} />
        </div>
      )}

      {filteredSubjects.length === 0 ? (
        <p className="subjects-empty">No subjects yet — add one to start tracking.</p>
      ) : (
        filteredSubjects.map(s => {
          const subjectLabels = (subjectLabelMap[s.id] ?? [])
            .map(id => labels.find(l => l.id === id))
            .filter((l): l is NonNullable<typeof l> => l !== undefined)
          return (
            <SubjectCard
              key={s.id}
              subject={s}
              labels={subjectLabels}
              proficiency={proficiencyMap[s.id] ?? null}
              boundaries={boundaryMap[s.id] ?? DEFAULT_BOUNDARIES}
              subjectXP={subjectXP[s.id] ?? 0}
              editMode={editMode}
              onEdit={() => setModalSubject(s.id)}
              onDelete={() => {
                setDeleteTarget(s.id)
                setDeleteConfirmName(s.name)
              }}
              onClick={() => navigate(`/subjects/${s.id}`)}
            />
          )
        })
      )}

      {modalSubject !== null && (
        <SubjectEditModal
          subject={modalSubject === 'new' ? null : editingSubject}
          onClose={() => setModalSubject(null)}
        />
      )}

      {deleteTarget && (
        <div className="confirm-toast show">
          <span>Delete <strong>{deleteConfirmName}</strong>?</span>
          <span className="confirm-sub">Removes all scores and boundaries for this subject.</span>
          <button className="toast-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="toast-delete" onClick={handleDeleteConfirm}>Delete</button>
        </div>
      )}
    </div>
  )
}
