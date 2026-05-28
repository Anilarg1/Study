import { describe, it, expect } from 'vitest'
import { calcProficiency, deriveGrade, DEFAULT_BOUNDARIES } from '../utils/proficiency'
import type { Assessment } from '../types'

function mkA(overrides: Partial<Assessment> = {}): Assessment {
  return {
    id: 'a1', subject_id: 's1', type: 'past_paper',
    title: 'Test', marks_obtained: 70, marks_total: 100,
    sat_on: '2024-01-01', paper_ref: null, created_at: '2024-01-01T00:00:00Z',
    percentage: 70,
    ...overrides,
  }
}

describe('calcProficiency', () => {
  it('returns null for empty array', () => {
    expect(calcProficiency([])).toBeNull()
  })

  it('returns percentage for single assessment', () => {
    expect(calcProficiency([mkA({ percentage: 80 })])).toBe(80)
  })

  it('averages only the last 5 by sat_on desc', () => {
    const assessments = [
      mkA({ sat_on: '2024-01-06', percentage: 90 }),
      mkA({ sat_on: '2024-01-05', percentage: 80 }),
      mkA({ sat_on: '2024-01-04', percentage: 70 }),
      mkA({ sat_on: '2024-01-03', percentage: 60 }),
      mkA({ sat_on: '2024-01-02', percentage: 50 }),
      mkA({ sat_on: '2024-01-01', percentage: 10 }),  // ignored
    ]
    // (90+80+70+60+50)/5 = 70
    expect(calcProficiency(assessments)).toBe(70)
  })

  it('rounds to 1 decimal place', () => {
    const assessments = [
      mkA({ sat_on: '2024-01-02', percentage: 77 }),
      mkA({ sat_on: '2024-01-01', percentage: 80 }),
    ]
    expect(calcProficiency(assessments)).toBe(78.5)
  })
})

describe('deriveGrade', () => {
  it('returns A* at 90', () => {
    expect(deriveGrade(90, DEFAULT_BOUNDARIES)).toBe('A*')
  })

  it('returns A at 75', () => {
    expect(deriveGrade(75, DEFAULT_BOUNDARIES)).toBe('A')
  })

  it('returns B at 65', () => {
    expect(deriveGrade(65, DEFAULT_BOUNDARIES)).toBe('B')
  })

  it('returns null below lowest boundary', () => {
    expect(deriveGrade(10, DEFAULT_BOUNDARIES)).toBeNull()
  })

  it('uses custom boundaries', () => {
    const custom = [{ grade: 'Pass', min_pct: 50, max_pct: 100 }]
    expect(deriveGrade(60, custom)).toBe('Pass')
    expect(deriveGrade(40, custom)).toBeNull()
  })
})
