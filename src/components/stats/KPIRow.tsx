import { memo } from 'react'
import { fmtMins } from '../../utils/date'

// ─── types ────────────────────────────────────────────────────────────────────

export interface RadarSubject {
  id:    string
  name:  string
  color: string
  mins:  number
  pct:   number
}

// ─── helpers ──────────────────────────────────────────────────────────────────

export function radarPts(N: number, R: number, cx: number, cy: number, values?: number[]): string {
  return Array.from({ length: N }, (_, i) => {
    const angle = -Math.PI / 2 + (i / N) * 2 * Math.PI
    const v = values ? (values[i] ?? 0) : 1
    return `${(cx + R * v * Math.cos(angle)).toFixed(2)},${(cy + R * v * Math.sin(angle)).toFixed(2)}`
  }).join(' ')
}

export function radarLabelPos(i: number, N: number, R: number, cx: number, cy: number, pad = 9) {
  const angle = -Math.PI / 2 + (i / N) * 2 * Math.PI
  return {
    x: cx + (R + pad) * Math.cos(angle),
    y: cy + (R + pad) * Math.sin(angle),
    anchor: (Math.cos(angle) < -0.3 ? 'end' : Math.cos(angle) > 0.3 ? 'start' : 'middle') as 'end' | 'start' | 'middle',
  }
}

// ─── sub-components ───────────────────────────────────────────────────────────

// KPI delta badge
export const Delta = memo(function Delta({ pct, label = 'vs prev' }: { pct: number; label?: string }) {
  if (pct === 0) return <span className="s-kpi-delta flat">—</span>
  const cls = pct > 0 ? 'up' : 'down'
  const arrow = (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor">
      {pct > 0
        ? <path d="M6 2 2 8h8z"/>
        : <path d="M6 10 2 4h8z"/>}
    </svg>
  )
  return (
    <span className={`s-kpi-delta ${cls}`}>
      {arrow}
      {pct > 0 ? '+' : ''}{pct}%
      <span className="vs">{label}</span>
    </span>
  )
})

// Sparkline built from real 14-day data
export const Sparkline = memo(function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(1, ...data)
  return (
    <div className="s-spark">
      {data.map((v, i) => {
        const norm = v / max
        const cls  = norm >= 0.7 ? 'f' : norm >= 0.35 ? 'f2' : norm > 0 ? 'f3' : ''
        return (
          <div
            key={i}
            className={`b${cls ? ' ' + cls : ''}`}
            style={{ height: `${Math.max(8, Math.round(norm * 100))}%` }}
          />
        )
      })}
    </div>
  )
})

// Radar chart — dynamic N subjects
export const SubjectRadar = memo(function SubjectRadar({
  subjects,
  totalMins,
}: {
  subjects: { id: string; name: string; color: string; mins: number; pct: number }[]
  totalMins: number
}) {
  const N  = subjects.length
  const R  = 32
  const cx = 50
  const cy = 50

  if (N === 0) {
    return (
      <div className="s-radar-wrap">
        <div className="s-empty" style={{ gridColumn: '1/-1' }}>No subject data yet</div>
      </div>
    )
  }

  const maxMins  = subjects[0]?.mins || 1
  const normVals = subjects.map(s => s.mins / maxMins)

  // Grid rings at 33%, 66%, 100%
  const rings = [0.33, 0.66, 1]

  return (
    <div className="s-radar-wrap">
      <svg className="s-radar" viewBox="0 0 100 100" aria-hidden="true">
        {/* grid rings */}
        {rings.map(scale => (
          <polygon
            key={scale}
            points={radarPts(N, R * scale, cx, cy)}
            fill="none"
            stroke="rgba(255,255,255,0.085)"
            strokeWidth="0.4"
          />
        ))}
        {/* axis lines */}
        {Array.from({ length: N }, (_, i) => {
          const angle = -Math.PI / 2 + (i / N) * 2 * Math.PI
          return (
            <line
              key={i}
              x1={cx} y1={cy}
              x2={(cx + R * Math.cos(angle)).toFixed(2)}
              y2={(cy + R * Math.sin(angle)).toFixed(2)}
              stroke="rgba(255,255,255,0.055)"
              strokeWidth="0.4"
            />
          )
        })}
        {/* data shape */}
        <polygon
          points={radarPts(N, R, cx, cy, normVals)}
          fill="color-mix(in oklab, var(--accent) 22%, transparent)"
          stroke="var(--accent)"
          strokeWidth="0.9"
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 4px var(--accent-soft))' }}
        />
        {/* dots */}
        {subjects.map((s, i) => {
          const angle = -Math.PI / 2 + (i / N) * 2 * Math.PI
          const v = normVals[i] ?? 0
          const px = (cx + R * v * Math.cos(angle)).toFixed(2)
          const py = (cy + R * v * Math.sin(angle)).toFixed(2)
          return (
            <circle key={s.id} cx={px} cy={py} r="2.4" fill={s.color} />
          )
        })}
        {/* labels */}
        {subjects.map((s, i) => {
          const pos = radarLabelPos(i, N, R, cx, cy, 10)
          return (
            <text
              key={s.id}
              x={pos.x.toFixed(1)}
              y={pos.y.toFixed(1)}
              textAnchor={pos.anchor}
              dominantBaseline="middle"
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: '3.4px',
                fill: 'var(--text-mute)',
                letterSpacing: '0.04em',
              }}
            >
              {s.name.slice(0, 6).toUpperCase()}
            </text>
          )
        })}
      </svg>

      <div className="s-radar-legend">
        {subjects.map(s => (
          <div key={s.id} className="s-radar-legend-row">
            <span className="dot" style={{ background: s.color }} />
            <span className="name">{s.name}</span>
            <span className="val">{s.pct}<sup>%</sup></span>
          </div>
        ))}
        {subjects.length > 0 && (
          <div className="s-radar-legend-foot">
            <span className="lead"><b>{subjects[0]?.name}</b> leads</span>
            <span className="cmp">{fmtMins(totalMins)} total</span>
          </div>
        )}
      </div>
    </div>
  )
})
