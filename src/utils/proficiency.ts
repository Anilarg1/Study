import type { Assessment, GradeBoundary } from '../types'

export const DEFAULT_BOUNDARIES: GradeBoundary[] = [
  { grade: 'A*', min_pct: 90, max_pct: 100 },
  { grade: 'A',  min_pct: 75, max_pct: 90  },
  { grade: 'B',  min_pct: 65, max_pct: 75  },
  { grade: 'C',  min_pct: 55, max_pct: 65  },
  { grade: 'D',  min_pct: 45, max_pct: 55  },
  { grade: 'E',  min_pct: 35, max_pct: 45  },
]

export function calcProficiency(assessments: Assessment[]): number | null {
  const last5 = [...assessments]
    .sort((a, b) => b.sat_on.localeCompare(a.sat_on))
    .slice(0, 5)
  if (last5.length === 0) return null
  const avg = last5.reduce((sum, a) => sum + a.percentage, 0) / last5.length
  return Math.round(avg * 10) / 10
}

export function deriveGrade(pct: number, boundaries: GradeBoundary[]): string | null {
  const sorted = [...boundaries].sort((a, b) => b.min_pct - a.min_pct)
  for (const b of sorted) {
    if (pct >= b.min_pct) return b.grade
  }
  return null
}
