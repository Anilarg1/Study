import { fmtMins } from '../../utils/date'
import Skeleton from '../Skeleton'

// ─── props ────────────────────────────────────────────────────────────────────

interface SubjectBreakdownProps {
  subjectStats:     { id: string; name: string; color: string; mins: number }[]
  subjectTotalMins: number
  totalMins:        number
  subjectFilter:    string | null
  onFilterChange:   (id: string | null) => void
  isLoading?:       boolean
}

// ─── component ────────────────────────────────────────────────────────────────

export function SubjectBreakdown({
  subjectStats,
  subjectTotalMins,
  totalMins,
  subjectFilter,
  onFilterChange,
  isLoading,
}: SubjectBreakdownProps) {
  return (
    <div className="sc">
      <div className="sc-head">
        <span className="sc-label">
          <svg className="ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <path d="M3.3 7 12 12l8.7-5M12 22V12"/>
          </svg>
          Subjects
        </span>
        <span className="sc-meta"><b>{fmtMins(totalMins)}</b> total</span>
      </div>

      {isLoading && subjectStats.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
          {[70, 50, 35].map((w, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Skeleton width={8} height={8} radius={4} />
              <Skeleton width={w} height={12} />
              <Skeleton width={30} height={8} className="ml-auto" />
            </div>
          ))}
        </div>
      ) : subjectStats.length === 0 ? (
        <div className="s-empty">No sessions with subjects yet</div>
      ) : (
        <>
          {/* Stacked bar */}
          <div className="s-stack-bar" title="Subject time mix">
            {subjectStats.map(s => (
              <div
                key={s.id}
                className="s-seg-piece"
                style={{ background: s.color, flex: s.mins }}
                title={`${s.name}: ${fmtMins(s.mins)}`}
              />
            ))}
          </div>

          {/* Subject rows */}
          {subjectStats.map(s => {
            const pct = Math.round(s.mins / subjectTotalMins * 100)
            return (
              <div
                key={s.id}
                className="s-subj-row"
                style={{ cursor: 'pointer' }}
                onClick={() => onFilterChange(s.id === subjectFilter ? null : s.id)}
              >
                <span className="dot" style={{ background: s.color }} />
                <span className="name">{s.name}</span>
                <span className="time">{fmtMins(s.mins)}</span>
                <span className="pct">{pct}%</span>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
