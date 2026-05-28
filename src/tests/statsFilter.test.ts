import { describe, it, expect } from 'vitest'

function toggleDate(current: string | null, clicked: string): string | null {
  return current === clicked ? null : clicked
}

describe('heatmap date filter', () => {
  it('selects a date on first click', () => {
    expect(toggleDate(null, '2026-05-20')).toBe('2026-05-20')
  })
  it('clears the date on second click (same date)', () => {
    expect(toggleDate('2026-05-20', '2026-05-20')).toBe(null)
  })
  it('switches to a new date', () => {
    expect(toggleDate('2026-05-20', '2026-05-21')).toBe('2026-05-21')
  })
})
