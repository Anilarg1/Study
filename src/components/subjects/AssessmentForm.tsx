import { useState } from 'react'
import useAssessmentStore from '../../store/useAssessmentStore'
import type { Assessment } from '../../types'

interface Props {
  subjectId: string
  type:      'past_paper' | 'school_test'
}

const LOG_LABEL: Record<Props['type'], string> = {
  past_paper:  'Log Past Paper',
  school_test: 'Log School Test',
}
const TITLE_PLACEHOLDER: Record<Props['type'], string> = {
  past_paper:  'e.g. 2024 Jan — Unit 4',
  school_test: 'e.g. Mock Exam 2',
}

export default function AssessmentForm({ subjectId, type }: Props) {
  const addAssessment = useAssessmentStore(s => s.addAssessment)

  const [open,     setOpen]     = useState(false)
  const [title,    setTitle]    = useState('')
  const [obtained, setObtained] = useState('')
  const [total,    setTotal]    = useState('')
  const [satOn,    setSatOn]    = useState(new Date().toISOString().slice(0, 10))
  const [error,    setError]    = useState<string | null>(null)
  const [saving,   setSaving]   = useState(false)

  function reset() {
    setTitle(''); setObtained(''); setTotal('')
    setSatOn(new Date().toISOString().slice(0, 10))
    setError(null)
    setOpen(false)
  }

  async function handleSubmit() {
    if (!title.trim()) { setError('Title is required.'); return }
    const oNum = parseFloat(obtained)
    const tNum = parseFloat(total)
    if (isNaN(oNum) || isNaN(tNum)) { setError('Marks must be numbers.'); return }
    if (tNum <= 0)                   { setError('Total marks must be greater than 0.'); return }
    if (oNum < 0)                    { setError('Marks obtained cannot be negative.'); return }

    setSaving(true)
    setError(null)
    const a: Omit<Assessment, 'id' | 'created_at' | 'percentage'> = {
      subject_id: subjectId,
      type,
      title: title.trim(),
      marks_obtained: oNum,
      marks_total: tNum,
      sat_on: satOn,
      paper_ref: null,
    }
    await addAssessment(a)
    setSaving(false)
    reset()
  }

  if (!open) {
    return (
      <div className="assessment-form-wrap">
        <button className="btn-log-assessment" onClick={() => setOpen(true)}>
          + {LOG_LABEL[type]}
        </button>
      </div>
    )
  }

  return (
    <div className="assessment-form-wrap">
      <div className="assessment-form">
        <div className="form-row">
          <label className="form-label">Title</label>
          <input
            className="form-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={TITLE_PLACEHOLDER[type]}
            autoFocus
          />
        </div>
        <div className="form-row form-row-inline">
          <div>
            <label className="form-label">Marks</label>
            <input
              className="form-input form-input-sm"
              type="number" min="0"
              value={obtained}
              onChange={e => setObtained(e.target.value)}
              placeholder="e.g. 72"
            />
          </div>
          <span className="form-divider">/ out of</span>
          <div>
            <label className="form-label">&nbsp;</label>
            <input
              className="form-input form-input-sm"
              type="number" min="1"
              value={total}
              onChange={e => setTotal(e.target.value)}
              placeholder="e.g. 90"
            />
          </div>
          <div>
            <label className="form-label">Date</label>
            <input
              className="form-input form-input-sm"
              type="date"
              value={satOn}
              onChange={e => setSatOn(e.target.value)}
            />
          </div>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button className="btn-secondary" onClick={reset} disabled={saving}>Cancel</button>
          <button className="btn-primary"   onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
