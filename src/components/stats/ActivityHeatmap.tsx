import { fmtMinsShort } from '../../utils/date'

// ─── types ────────────────────────────────────────────────────────────────────

export interface HeatCell {
  ds:     string
  lvl:    0 | 1 | 2 | 3 | 4
  future: boolean
  mins:   number
}

// ─── props ────────────────────────────────────────────────────────────────────

interface ActivityHeatmapProps {
  heatWeeks:         HeatCell[][]
  heatMonthLabels:   { label: string; width: number }[]
  activeDays:        number
  longestHeatStreak: number
  filterDate?:       string | null
  onCellClick?:      (date: string) => void
}

// ─── component ────────────────────────────────────────────────────────────────

export function ActivityHeatmap({
  heatWeeks,
  heatMonthLabels,
  activeDays,
  longestHeatStreak,
  filterDate,
  onCellClick,
}: ActivityHeatmapProps) {
  return (
    <section className="sc" style={{ marginBottom: 12 }}>
      <div className="sc-head">
        <span className="sc-label">
          <svg className="ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>
          </svg>
          Activity
          <span style={{ color: 'var(--text-mute)', fontWeight: 400, marginLeft: 4 }}>— last 12 months</span>
        </span>
        <span className="sc-meta">
          <b>{activeDays}</b> active days
        </span>
      </div>

      {activeDays === 0 && (
        <div className="s-empty" style={{ textAlign: 'center', padding: '24px 0' }}>
          No sessions yet — complete your first timer session to see activity
        </div>
      )}

      {/* Month labels */}
      {activeDays > 0 && (
        <>
          <div className="s-heatmap-months">
            {heatMonthLabels.map((m, i) => (
              <span key={i} style={{ width: `${m.width * 14}px` }}>{m.label}</span>
            ))}
          </div>

          <div className="s-heatmap-wrap">
            <div className="s-heatmap-days">
              <span/><span>Mon</span><span/><span>Wed</span><span/><span>Fri</span><span/>
            </div>
            <div className="s-heatmap">
              {heatWeeks.map((week, wi) => (
                <div key={wi} className="s-week-col">
                  {week.map((cell, di) => (
                    <div
                      key={di}
                      className={`s-h-cell${cell.future ? ' empty' : cell.lvl ? ` l${cell.lvl}` : ''}${filterDate === cell.ds ? ' selected' : ''}`}
                      title={cell.future ? '' : `${cell.ds}${cell.mins ? ` · ${fmtMinsShort(cell.mins)}` : ''}`}
                      onClick={cell.future || !onCellClick ? undefined : () => onCellClick(cell.ds)}
                      style={onCellClick && !cell.future ? { cursor: 'pointer' } : undefined}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="s-heat-foot">
        <span>
          Longest streak · last 12 months ·{' '}
          <b style={{ color: 'var(--text-dim)' }}>{longestHeatStreak > 0 ? `${longestHeatStreak} days` : '—'}</b>
        </span>
        <div className="s-heat-scale">
          <span>Less</span>
          <div className="s-h-cell" />
          <div className="s-h-cell l1" />
          <div className="s-h-cell l2" />
          <div className="s-h-cell l3" />
          <div className="s-h-cell l4" />
          <span>More</span>
        </div>
      </div>
    </section>
  )
}
