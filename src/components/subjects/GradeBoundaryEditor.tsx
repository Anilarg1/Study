import { useState } from 'react'
import type { GradeBoundary } from '../../types'
import { deriveGrade } from '../../utils/proficiency'

interface Props {
  boundaries: GradeBoundary[]
  currentPct: number | null
  onSave(updated: GradeBoundary[]): Promise<void>
  onReset(): Promise<void>
}

export default function GradeBoundaryEditor({ boundaries, currentPct, onSave, onReset }: Props) {
  const [editing, setEditing] = useState<GradeBoundary[]>(boundaries)
  const [saving,  setSaving]  = useState(false)

  const sortedEditing = [...editing].sort((a, b) => b.min_pct - a.min_pct)
  const currentGrade  = currentPct !== null ? deriveGrade(currentPct, editing) : null

  function updateField(grade: string, field: 'min_pct' | 'max_pct', val: string) {
    const num = parseFloat(val)
    if (isNaN(num)) return
    setEditing(prev => prev.map(b => b.grade === grade ? { ...b, [field]: num } : b))
  }

  async function handleSave() {
    setSaving(true)
    await onSave(editing)
    setSaving(false)
  }

  async function handleReset() {
    setSaving(true)
    await onReset()
    setSaving(false)
  }

  return (
    <div className="boundary-editor">
      <table className="boundary-table">
        <thead>
          <tr>
            <th>Grade</th>
            <th>Min %</th>
            <th>Max %</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sortedEditing.map(b => (
            <tr key={b.grade} className={currentGrade === b.grade ? 'boundary-row-current' : ''}>
              <td className="boundary-grade">{b.grade}</td>
              <td>
                <input
                  className="form-input form-input-sm"
                  type="number" min="0" max="100"
                  value={b.min_pct}
                  onChange={e => updateField(b.grade, 'min_pct', e.target.value)}
                />
              </td>
              <td>
                <input
                  className="form-input form-input-sm"
                  type="number" min="0" max="100"
                  value={b.max_pct}
                  onChange={e => updateField(b.grade, 'max_pct', e.target.value)}
                />
              </td>
              <td>
                {currentGrade === b.grade && (
                  <span className="boundary-you-here">← you are here</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {currentPct !== null && (
        <div className="boundary-summary">
          Your score: <strong>{currentPct}%</strong>
          {currentGrade && <> · Current grade: <strong>{currentGrade}</strong></>}
        </div>
      )}

      <div className="form-actions">
        <button className="btn-ghost" onClick={handleReset} disabled={saving}>
          Reset to defaults
        </button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save boundaries'}
        </button>
      </div>
    </div>
  )
}
