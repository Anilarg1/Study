import type { Subject, SubjectLabel, GradeBoundary } from '../../types'
import { getMasteryFromXP } from '../../utils/progression'
import { deriveGrade } from '../../utils/proficiency'

interface Props {
  subject:     Subject
  labels:      SubjectLabel[]
  proficiency: number | null
  boundaries:  GradeBoundary[]
  subjectXP:   number
  editMode:    boolean
  onEdit():    void
  onDelete():  void
  onClick?():  void   // for navigation in non-edit mode
}

function profColor(pct: number): string {
  if (pct >= 75) return '#4ade80'
  if (pct >= 65) return '#fbbf24'
  return '#ef4444'
}

function gapLabel(proficiency: number | null, targetGrade: string | null, boundaries: GradeBoundary[]): string {
  if (!proficiency || !targetGrade) return '—'
  const target = boundaries.find(b => b.grade === targetGrade)
  if (!target) return '—'
  const gap = target.min_pct - proficiency
  if (gap <= 0) return '✓ target met'
  return `−${gap.toFixed(1)}% to ${targetGrade}`
}

function gapColor(proficiency: number | null, targetGrade: string | null, boundaries: GradeBoundary[]): string {
  if (!proficiency || !targetGrade) return 'var(--text-mute)'
  const target = boundaries.find(b => b.grade === targetGrade)
  if (!target) return 'var(--text-mute)'
  return (target.min_pct - proficiency) <= 0 ? '#4ade80' : '#ef4444'
}

export default function SubjectCard({
  subject, labels, proficiency, boundaries, subjectXP, editMode, onEdit, onDelete, onClick,
}: Props) {
  const grade      = proficiency !== null ? deriveGrade(proficiency, boundaries) : null
  const mastery    = getMasteryFromXP(subjectXP)  // returns MasteryInfo, never null
  // mastery.index is already the 0-4 index — use it directly
  const masteryIdx = mastery.index

  return (
    <div
      className={`s-card${editMode ? ' edit-mode' : ''}`}
      onClick={!editMode ? onClick : undefined}
      style={{ cursor: editMode ? 'default' : 'pointer' }}
    >
      <span className="s-dot" style={{ background: subject.color }} />

      <div className="s-identity">
        <span className="s-name">{subject.name}</span>
        {subject.exam_board && <span className="s-board">{subject.exam_board}</span>}
      </div>

      {labels.length > 0 && (
        <div className="s-labels">
          {labels.map(l => (
            <span key={l.id} className="s-label-chip">{l.name}</span>
          ))}
        </div>
      )}

      <div className="s-spacer" />

      {!editMode && (
        <>
          <div className="s-prof-wrap">
            {proficiency !== null ? (
              <>
                <div className="s-prof-bar-track">
                  <div
                    className="s-prof-bar-fill"
                    style={{ width: `${proficiency}%`, background: profColor(proficiency) }}
                  />
                </div>
                <span className="s-prof-pct" style={{ color: profColor(proficiency) }}>
                  {proficiency}%
                </span>
              </>
            ) : (
              <span className="s-no-prof">no scores yet</span>
            )}
          </div>

          <span
            className="s-grade"
            style={{ color: grade && proficiency !== null ? profColor(proficiency) : 'var(--text-faint)' }}
          >
            {grade ?? '—'}
          </span>

          <span className="s-target" style={{ color: gapColor(proficiency, subject.target_grade, boundaries) }}>
            {gapLabel(proficiency, subject.target_grade, boundaries)}
          </span>

          <span className="s-mastery" title={mastery.name}>
            {'🔥'.repeat(Math.max(1, masteryIdx + 1)).slice(0, 1)}
          </span>
        </>
      )}

      {editMode && (
        <div className="s-actions">
          <button className="act-btn act-edit" onClick={onEdit}>Edit</button>
          <button className="act-btn act-del"  onClick={onDelete}>Delete</button>
        </div>
      )}
    </div>
  )
}
