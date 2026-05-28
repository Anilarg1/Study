import type { Assessment } from '../../types'

interface Props {
  assessments: Assessment[]
}

const W = 200
const H = 48
const PAD = 4

export default function ProficiencyChart({ assessments }: Props) {
  const sorted = [...assessments].sort((a, b) => a.sat_on.localeCompare(b.sat_on))
  if (sorted.length < 2) return null

  const pcts  = sorted.map(a => a.percentage)
  const minP  = Math.min(...pcts)
  const maxP  = Math.max(...pcts)
  const range = maxP - minP || 1

  const xAt = (i: number) => PAD + (i / (pcts.length - 1)) * (W - PAD * 2)
  const yAt = (p: number) => H - PAD - ((p - minP) / range) * (H - PAD * 2)

  const points = pcts.map((p, i) => `${xAt(i)},${yAt(p)}`).join(' ')
  const lastX = xAt(pcts.length - 1)
  const lastY = yAt(pcts[pcts.length - 1]!)

  const compareFrom = pcts.length >= 3 ? pcts[pcts.length - 3]! : pcts[0]!
  const trend = pcts[pcts.length - 1]! - compareFrom

  return (
    <div className="prof-chart">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.5"
        />
        <circle cx={lastX} cy={lastY} r="3" fill="var(--accent)" />
      </svg>
      {trend !== 0 && (
        <span
          className="prof-trend"
          style={{ color: trend >= 0 ? '#4ade80' : '#ef4444' }}
        >
          {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
        </span>
      )}
    </div>
  )
}
