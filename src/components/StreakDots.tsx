import { useMemo } from 'react'
import useStreakStore from '../store/useStreakStore'
import { toLocalDateStr } from '../utils/date'

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function StreakDots() {
  const loginDates = useStreakStore(s => s.loginDates)
  const dateSet    = useMemo(() => new Set(loginDates), [loginDates])

  const last7 = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86_400_000)
    return { dateStr: toLocalDateStr(d), label: DAY_LETTERS[d.getDay()]!, isToday: i === 6 }
  }), [])

  return (
    <svg width="100%" viewBox="0 0 154 34" style={{ display: 'block', overflow: 'visible' }}>
      {last7.map(({ dateStr, label, isToday }, i) => {
        const logged = dateSet.has(dateStr)
        const cx = 11 + i * 22, cy = 11
        return (
          <g key={dateStr}>
            <circle cx={cx} cy={cy} r={isToday ? 8.5 : 7}
              fill={logged ? 'var(--streak)' : 'var(--surface-3)'}
              stroke={isToday && !logged ? 'var(--hairline-2)' : 'none'} strokeWidth={1.5}
              opacity={logged ? (isToday ? 1 : 0.72) : 0.45} />
            {logged && (
              <path d={`M${cx - 3.5} ${cy} L${cx - 1} ${cy + 2.5} L${cx + 3.5} ${cy - 3}`}
                stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            )}
            <text x={cx} y={30} textAnchor="middle" fontSize={8}
              fill={isToday ? 'var(--text-dim)' : 'var(--text-faint)'}
              fontFamily="Geist Mono, monospace">
              {label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
