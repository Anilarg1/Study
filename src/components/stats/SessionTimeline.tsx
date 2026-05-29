import EmptyState from '../EmptyState'
import { fmtMins } from '../../utils/date'
import type { SessionEntry } from '../../types'

// ─── helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmtDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  const date = `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`
  const h    = d.getHours()
  const m    = String(d.getMinutes()).padStart(2, '0')
  const period = h < 12 ? 'am' : 'pm'
  const h12  = h % 12 === 0 ? 12 : h % 12
  return { date, time: `${h12}:${m}${period}` }
}

// ─── props ────────────────────────────────────────────────────────────────────

interface SessionTimelineProps {
  sessions:   SessionEntry[]
  subjectMap: Map<string, { name: string; color: string }>
  maxRows?:   number
  isLoading?: boolean
}

// ─── component ────────────────────────────────────────────────────────────────

export function SessionTimeline({
  sessions,
  subjectMap,
  maxRows = 20,
  isLoading = false,
}: SessionTimelineProps) {
  // Most-recent first, work sessions only
  const rows = sessions
    .filter(s => s.type === 'work')
    .slice()
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, maxRows)

  return (
    <div className="sc">
      <div className="sc-head">
        <span className="sc-label">
          <svg className="ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          Recent sessions
        </span>
        <span className="sc-meta">{sessions.filter(s => s.type === 'work').length} total</span>
      </div>

      {isLoading && rows.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ height: 32, background: 'var(--surface-2)', borderRadius: 6, opacity: 0.6 }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
            </svg>
          }
          title="No sessions yet"
          subtitle="Complete a work session to see your history here"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {rows.map((s, i) => {
            const { date, time } = fmtDateTime(s.completedAt)
            const subj = s.subjectId ? subjectMap.get(s.subjectId) : null
            const mins = s.durationSecs != null ? Math.round(s.durationSecs / 60) : 0

            return (
              <div
                key={s.id}
                style={{
                  display:       'flex',
                  alignItems:    'center',
                  gap:           10,
                  padding:       '7px 0',
                  borderBottom:  i < rows.length - 1 ? '1px solid var(--hairline)' : 'none',
                }}
              >
                {/* subject dot */}
                <span
                  style={{
                    width:        6,
                    height:       6,
                    borderRadius: '50%',
                    flexShrink:   0,
                    background:   subj?.color ?? 'var(--text-faint)',
                  }}
                />

                {/* date + time */}
                <div style={{ minWidth: 88, flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{date}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1 }}>{time}</div>
                </div>

                {/* subject name */}
                <div style={{ flex: 1, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {subj?.name ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}
                </div>

                {/* duration */}
                <div style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>
                  {mins > 0 ? fmtMins(mins) : '—'}
                </div>

                {/* xp */}
                {s.xp > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--xp, #f59e0b)', fontWeight: 600, flexShrink: 0, minWidth: 36, textAlign: 'right' }}>
                    +{s.xp}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
