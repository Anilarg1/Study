import { fmtMins } from '../../utils/date'

// ─── constants ────────────────────────────────────────────────────────────────

export const HIST_BUCKETS = [
  { label: '≤5',  max: 5        },
  { label: '10',  max: 10       },
  { label: '15',  max: 15       },
  { label: '20',  max: 20       },
  { label: '25',  max: 25       },
  { label: '30',  max: 30       },
  { label: '40',  max: 40       },
  { label: '50',  max: 50       },
  { label: '60',  max: 60       },
  { label: '90+', max: Infinity },
]

// ─── props ────────────────────────────────────────────────────────────────────

interface SessionHistogramProps {
  histData:     { label: string; count: number; height: number; isPeak: boolean }[]
  histStats:    { median: number; mean: number; longest: number; completed: number }
  sessionCount: number
}

// ─── component ────────────────────────────────────────────────────────────────

export function SessionHistogram({
  histData,
  histStats,
  sessionCount,
}: SessionHistogramProps) {
  return (
    <div className="sc">
      <div className="sc-head">
        <span className="sc-label">
          <svg className="ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 21h18M6 17V13M10 17V9M14 17V11M18 17V7"/>
          </svg>
          Session length distribution
        </span>
        <span className="sc-meta">{sessionCount} sessions</span>
      </div>

      {sessionCount === 0 ? (
        <div className="s-empty">No sessions yet</div>
      ) : (
        <>
          <div className="s-hist">
            {histData.map((b, i) => (
              <div
                key={i}
                className={`s-hist-col${b.isPeak ? ' peak' : ''}`}
                style={{ height: `${b.height}%` }}
              >
                <span className="label">{b.count}</span>
              </div>
            ))}
          </div>
          <div className="s-hist-x">
            {HIST_BUCKETS.map(b => <span key={b.label}>{b.label}</span>)}
          </div>
          <div className="s-hist-foot">
            <div><span className="lbl">Median</span><span className="val">{histStats.median} min</span></div>
            <div><span className="lbl">Mean</span><span className="val">{histStats.mean} min</span></div>
            <div><span className="lbl">Longest</span><span className="val">{fmtMins(histStats.longest)}</span></div>
            <div>
              <span className="lbl">Completed</span>
              <span className="val">{histStats.completed} / {sessionCount}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
