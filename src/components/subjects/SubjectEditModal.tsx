import { useState, useEffect } from 'react'
import type { Subject, SubjectLabel } from '../../types'
import useSubjectStore from '../../store/useSubjectStore'
import useSubjectLabelStore from '../../store/useSubjectLabelStore'
import { SUBJECT_COLORS } from '../../lib/subjects'

interface Props {
  subject: Subject | null   // null = create mode
  onClose(): void
}

export default function SubjectEditModal({ subject, onClose }: Props) {
  const addSubject   = useSubjectStore(s => s.addSubject)
  const editSubject  = useSubjectStore(s => s.editSubject)

  const labels             = useSubjectLabelStore(s => s.labels)
  const subjectLabelMap    = useSubjectLabelStore(s => s.subjectLabelMap)
  const loadLabels         = useSubjectLabelStore(s => s.loadLabels)
  const createLabel        = useSubjectLabelStore(s => s.createLabel)
  const setSubjectLabels   = useSubjectLabelStore(s => s.setSubjectLabels)

  const isCreate = subject === null

  const [name,          setName]          = useState(subject?.name ?? '')
  const [color,         setColor]         = useState(subject?.color ?? SUBJECT_COLORS[0] ?? '#8b85ff')
  const [examBoard,     setExamBoard]     = useState(subject?.exam_board ?? '')
  const [targetGrade,   setTargetGrade]   = useState(subject?.target_grade ?? '')
  const [selectedLabels, setSelectedLabels] = useState<string[]>(
    subject ? (subjectLabelMap[subject.id] ?? []) : []
  )
  const [newLabelName, setNewLabelName] = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  useEffect(() => { loadLabels() }, [loadLabels])

  function toggleLabel(id: string) {
    setSelectedLabels(prev =>
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    )
  }

  async function handleAddLabel() {
    const trimmed = newLabelName.trim()
    if (!trimmed) return
    const label = await createLabel(trimmed)
    if (label) {
      setSelectedLabels(prev => [...prev, label.id])
      setNewLabelName('')
    }
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('Subject name is required.'); return }
    setSubmitting(true)
    setError(null)

    const opts = {
      exam_board:   examBoard.trim()   || null,
      target_grade: targetGrade.trim() || null,
    }

    if (isCreate) {
      const s = await addSubject(name.trim(), color, opts)
      if (!s) { setError('Could not save — check your connection.'); setSubmitting(false); return }
      await setSubjectLabels(s.id, selectedLabels)
    } else {
      await editSubject(subject.id, { name: name.trim(), color, ...opts })
      await setSubjectLabels(subject.id, selectedLabels)
    }

    setSubmitting(false)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isCreate ? 'New subject' : 'Edit subject'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-row">
            <label className="form-label">Name</label>
            <input
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Physics"
              autoFocus
            />
          </div>

          <div className="form-row">
            <label className="form-label">Color</label>
            <div className="color-swatches">
              {SUBJECT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch${color === c ? ' selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="form-row">
            <label className="form-label">
              Exam board <span className="form-optional">(optional)</span>
            </label>
            <input
              className="form-input"
              value={examBoard}
              onChange={e => setExamBoard(e.target.value)}
              placeholder="e.g. Edexcel IAL"
            />
          </div>

          <div className="form-row">
            <label className="form-label">
              Target grade <span className="form-optional">(optional)</span>
            </label>
            <input
              className="form-input"
              value={targetGrade}
              onChange={e => setTargetGrade(e.target.value)}
              placeholder="e.g. A*"
            />
          </div>

          <div className="form-row">
            <label className="form-label">Labels</label>
            <div className="label-chips">
              {labels.map((l: SubjectLabel) => (
                <button
                  key={l.id}
                  type="button"
                  className={`label-chip${selectedLabels.includes(l.id) ? ' selected' : ''}`}
                  onClick={() => toggleLabel(l.id)}
                >
                  {l.name}
                </button>
              ))}
              <div className="label-add-row">
                <input
                  className="form-input form-input-sm"
                  placeholder="New label…"
                  value={newLabelName}
                  onChange={e => setNewLabelName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddLabel()}
                />
                <button className="btn-ghost-sm" type="button" onClick={handleAddLabel}>
                  Add
                </button>
              </div>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : isCreate ? 'Create' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
