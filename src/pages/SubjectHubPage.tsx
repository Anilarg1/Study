import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useSubjectStore from '../store/useSubjectStore'
import useSubjectMasteryStore from '../store/useSubjectMasteryStore'
import useAssessmentStore from '../store/useAssessmentStore'
import useSubjectLabelStore from '../store/useSubjectLabelStore'
import { getCurrentUserId } from '../lib/currentUser'
import { fetchGradeBoundaries, upsertGradeBoundaries } from '../lib/supabase'
import { calcProficiency, deriveGrade, DEFAULT_BOUNDARIES } from '../utils/proficiency'
import type { GradeBoundary } from '../types'
import ProficiencyChart from '../components/subjects/ProficiencyChart'
import AssessmentForm from '../components/subjects/AssessmentForm'
import GradeBoundaryEditor from '../components/subjects/GradeBoundaryEditor'

type Tab = 'stats' | 'past-papers' | 'school-tests' | 'grade-boundaries'

const TAB_LABELS: Record<Tab, string> = {
  'stats': 'Stats',
  'past-papers': 'Past Papers',
  'school-tests': 'School Tests',
  'grade-boundaries': 'Grade Boundaries',
}

function pctColor(pct: number): string {
  if (pct >= 75) return '#4ade80'
  if (pct >= 65) return '#fbbf24'
  return '#ef4444'
}

export default function SubjectHubPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const subject    = useSubjectStore(s => s.subjects.find(x => x.id === id))
  const subjectXP  = useSubjectMasteryStore(s => s.subjectXP)

  const assessments      = useAssessmentStore(s => s.assessments)
  const isLoadingA       = useAssessmentStore(s => s.isLoading)
  const loadForSubject   = useAssessmentStore(s => s.loadForSubject)
  const removeAssessment = useAssessmentStore(s => s.removeAssessment)

  const labels              = useSubjectLabelStore(s => s.labels)
  const subjectLabelMap     = useSubjectLabelStore(s => s.subjectLabelMap)
  const loadLabels          = useSubjectLabelStore(s => s.loadLabels)
  const loadSubjectLabelMap = useSubjectLabelStore(s => s.loadSubjectLabelMap)

  const [tab,        setTab]        = useState<Tab>('stats')
  const [boundaries, setBoundaries] = useState<GradeBoundary[]>(DEFAULT_BOUNDARIES)

  useEffect(() => {
    if (!id) return
    loadForSubject(id)
    loadLabels()
    loadSubjectLabelMap([id])
    const userId = getCurrentUserId()
    if (!userId) return
    fetchGradeBoundaries(userId, id).then(({ data }) => {
      setBoundaries(data.length > 0 ? data : DEFAULT_BOUNDARIES)
    })
  }, [id, loadForSubject, loadLabels, loadSubjectLabelMap])

  if (!subject) {
    return (
      <div className="subjects-hub-page">
        <button className="hub-back" onClick={() => navigate('/subjects')}>← Subjects</button>
        <p className="subjects-empty">Subject not found.</p>
      </div>
    )
  }

  const proficiency  = calcProficiency(assessments)
  const grade        = proficiency !== null ? deriveGrade(proficiency, boundaries) : null
  const subjectLabels = (subjectLabelMap[subject.id] ?? [])
    .map(lid => labels.find(l => l.id === lid))
    .filter((l): l is NonNullable<typeof l> => l !== undefined)

  const pastPapers  = assessments.filter(a => a.type === 'past_paper')
  const schoolTests = assessments.filter(a => a.type === 'school_test')
  const recent4     = assessments.slice(0, 4)
  const xp          = subjectXP[subject.id] ?? 0

  async function handleSaveBoundaries(updated: GradeBoundary[]) {
    const userId = getCurrentUserId()
    if (!userId || !id) return
    const error = await upsertGradeBoundaries(userId, id, updated)
    if (!error) setBoundaries(updated)
  }

  async function handleResetBoundaries() {
    const userId = getCurrentUserId()
    if (!userId || !id) return
    await upsertGradeBoundaries(userId, id, DEFAULT_BOUNDARIES)
    setBoundaries(DEFAULT_BOUNDARIES)
  }

  return (
    <div className="subjects-hub-page">
      {/* Header */}
      <div className="hub-header">
        <button className="hub-back" onClick={() => navigate('/subjects')}>← Subjects</button>

        <div className="hub-title-row">
          <span className="hub-dot" style={{ background: subject.color }} />
          <h1 className="hub-name">{subject.name}</h1>
          {subject.exam_board && (
            <span className="hub-badge hub-badge-purple">{subject.exam_board}</span>
          )}
          {subject.target_grade && (
            <span className="hub-badge hub-badge-orange">Target: {subject.target_grade}</span>
          )}
        </div>

        {subjectLabels.length > 0 && (
          <div className="hub-label-row">
            {subjectLabels.map(l => (
              <span key={l.id} className="s-label-chip">{l.name}</span>
            ))}
          </div>
        )}

        <div className="hub-kpi-row">
          <div className="hub-kpi">
            <span className="hub-kpi-val">{xp.toLocaleString()}</span>
            <span className="hub-kpi-lbl">XP</span>
          </div>
          <div className="hub-kpi">
            <span className="hub-kpi-val">{assessments.length}</span>
            <span className="hub-kpi-lbl">Assessments</span>
          </div>
        </div>
      </div>

      {/* Tab strip */}
      <div className="hub-tabs">
        {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
          <button
            key={t}
            className={`hub-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Stats tab */}
      {tab === 'stats' && (
        <div className="hub-tab-content">
          <div className="prof-card">
            <div className="prof-card-left">
              <span
                className="prof-big"
                style={{ color: proficiency !== null ? pctColor(proficiency) : 'var(--text-faint)' }}
              >
                {proficiency !== null ? `${proficiency}%` : '—'}
              </span>
              {grade && <span className="grade-badge">{grade}</span>}
              <ProficiencyChart assessments={assessments} />
            </div>
          </div>

          {recent4.length > 0 && (
            <div className="hub-section">
              <h3 className="hub-section-title">Recent Scores</h3>
              {recent4.map(a => (
                <div key={a.id} className="score-row">
                  <span className={`score-type-badge score-type-${a.type}`}>
                    {a.type === 'past_paper' ? 'paper' : 'school'}
                  </span>
                  <span className="score-title">{a.title}</span>
                  <span className="score-date">{a.sat_on}</span>
                  <span className="score-pct" style={{ color: pctColor(a.percentage) }}>
                    {a.percentage}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {(() => {
            if (!subject.target_grade || proficiency === null) return null
            const target = boundaries.find(b => b.grade === subject.target_grade)
            if (!target) return null
            const gap    = target.min_pct - proficiency
            const barPct = Math.min(100, (proficiency / target.min_pct) * 100)
            return (
              <div className="hub-section">
                <h3 className="hub-section-title">Progress to Target</h3>
                <div className="progress-row">
                  <span className="progress-grade">{grade ?? '—'}</span>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${barPct}%` }} />
                  </div>
                  <span className="progress-grade">{subject.target_grade}</span>
                </div>
                <p className="progress-gap" style={{ color: gap <= 0 ? '#4ade80' : '#ef4444' }}>
                  {gap <= 0 ? '✓ Target met' : `${gap.toFixed(1)}% to go`}
                </p>
              </div>
            )
          })()}

          {assessments.length === 0 && !isLoadingA && (
            <p className="subjects-empty">
              No assessments yet — log one in Past Papers or School Tests.
            </p>
          )}
        </div>
      )}

      {/* Past Papers tab */}
      {tab === 'past-papers' && id && (
        <div className="hub-tab-content">
          <AssessmentForm subjectId={id} type="past_paper" />
          {pastPapers.length === 0 ? (
            <p className="subjects-empty">No past paper results logged yet.</p>
          ) : (
            <table className="assessment-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Date</th>
                  <th>Marks</th>
                  <th>%</th>
                  <th>Grade</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pastPapers.map(a => (
                  <tr key={a.id}>
                    <td>{a.title}</td>
                    <td>{a.sat_on}</td>
                    <td>{a.marks_obtained}/{a.marks_total}</td>
                    <td style={{ color: pctColor(a.percentage) }}>{a.percentage}%</td>
                    <td>{deriveGrade(a.percentage, boundaries) ?? '—'}</td>
                    <td>
                      <button className="act-del-sm" onClick={() => removeAssessment(a.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* School Tests tab */}
      {tab === 'school-tests' && id && (
        <div className="hub-tab-content">
          <AssessmentForm subjectId={id} type="school_test" />
          {schoolTests.length === 0 ? (
            <p className="subjects-empty">No school test scores logged yet.</p>
          ) : (
            <div className="score-list">
              {schoolTests.map(a => (
                <div key={a.id} className="score-row">
                  <span className="score-type-badge score-type-school_test">school</span>
                  <span className="score-title">{a.title}</span>
                  <span className="score-date">{a.sat_on}</span>
                  <span className="score-pct" style={{ color: pctColor(a.percentage) }}>
                    {a.percentage}%
                  </span>
                  <button className="act-del-sm" onClick={() => removeAssessment(a.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grade Boundaries tab */}
      {tab === 'grade-boundaries' && (
        <div className="hub-tab-content">
          <GradeBoundaryEditor
            boundaries={boundaries}
            currentPct={proficiency}
            onSave={handleSaveBoundaries}
            onReset={handleResetBoundaries}
          />
        </div>
      )}
    </div>
  )
}
