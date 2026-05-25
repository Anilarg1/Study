import { fmtMinsShort } from '../../utils/date'

// ─── types ────────────────────────────────────────────────────────────────────

export type ChartBar = {
  label:       string
  mins:        number
  isWeekend:   boolean
  isHighlight: boolean
  isWeekly:    boolean
}

// ─── props ────────────────────────────────────────────────────────────────────

interface FocusTimeChartProps {
  chartBars:  ChartBar[]
  maxBarMins: number
  avgBarMins: number
  yMax:       number
  totalMins:  number
  rangeLabel: string
}

// ─── component ────────────────────────────────────────────────────────────────

export function FocusTimeChart({
  chartBars,
  avgBarMins,
  yMax,
  totalMins,
  rangeLabel,
}: FocusTimeChartProps) {
  return (
    <section className="sc" style={{ marginBottom: 12 }}>
      <div className="sc-head">
        <span className="sc-label">
          <svg className="ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 21h18M6 17v-6M11 17V9M16 17v-4M21 17V6"/>
          </svg>
          Focused time per day
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="s-legend">
            <span className="lg-key"><span className="lg-swatch"/> {chartBars[0]?.isWeekly ? 'Week' : 'Weekday'}</span>
            {!chartBars[0]?.isWeekly && (
              <span className="lg-key"><span className="lg-swatch muted"/> Weekend</span>
            )}
            {avgBarMins > 0 && <span className="lg-key"><span className="lg-swatch line"/> avg</span>}
          </div>
          <span className="sc-meta">{rangeLabel.toUpperCase()}</span>
        </div>
      </div>

      {chartBars.length === 0 || totalMins === 0 ? (
        <div className="s-empty">No focus sessions in this period</div>
      ) : (
        <>
          <div className="s-chart-wrap">
            {/* Y-axis */}
            <div className="s-y-axis">
              {Array.from({ length: yMax + 1 }, (_, i) => {
                const pct = (1 - i / yMax) * 100
                return (
                  <span key={i} style={{ top: `${pct}%` }}>
                    {i > 0 ? <>{i}<sup>h</sup></> : '0'}
                  </span>
                )
              })}
            </div>

            {/* Plot */}
            <div className="s-plot">
              {Array.from({ length: yMax + 1 }, (_, i) => (
                <div key={i} className="s-grid-line" style={{ top: `${(1 - i / yMax) * 100}%` }} />
              ))}

              {/* Avg line */}
              {avgBarMins > 0 && (
                <div
                  className="s-avg-line"
                  style={{ top: `${(1 - avgBarMins / (yMax * 60)) * 100}%` }}
                >
                  <span className="lbl">avg {fmtMinsShort(avgBarMins)}</span>
                </div>
              )}

              <div className="s-bars">
                {chartBars.map((day, i) => {
                  const heightPct = (day.mins / (yMax * 60)) * 100
                  const cls = day.isHighlight ? 'today' : day.isWeekend ? 'weekend' : ''
                  return (
                    <div key={i} className="s-bar-col">
                      <span className="s-bar-tip">
                        {fmtMinsShort(day.mins)} · {day.label}
                      </span>
                      <div
                        className={`s-bar${cls ? ' ' + cls : ''}`}
                        style={{ height: `${Math.max(0, heightPct)}%` }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* X-axis ticks */}
          <div className="s-x-axis">
            {(() => {
              const n = chartBars.length
              const ticks = n <= 7  ? [0, n - 1]
                : n <= 30 ? [0, Math.floor(n / 3), Math.floor(2 * n / 3), n - 1]
                : [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(3 * n / 4), n - 1]
              return ticks.map(i => (
                <span key={i}>{chartBars[i]?.label.toUpperCase()}</span>
              ))
            })()}
          </div>
        </>
      )}
    </section>
  )
}
