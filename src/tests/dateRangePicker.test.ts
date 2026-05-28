import { describe, it, expect } from 'vitest'

function parseCustomRange(from: string | null, to: string | null): { from: Date; to: Date } | null {
  if (!from || !to) return null
  const f = new Date(from)
  const t = new Date(to)
  if (isNaN(f.getTime()) || isNaN(t.getTime())) return null
  if (f > t) return null
  return { from: f, to: t }
}

describe('parseCustomRange', () => {
  it('returns null for missing inputs', () => {
    expect(parseCustomRange(null, '2026-05-01')).toBeNull()
    expect(parseCustomRange('2026-04-01', null)).toBeNull()
  })
  it('returns null when from > to', () => {
    expect(parseCustomRange('2026-05-10', '2026-05-01')).toBeNull()
  })
  it('returns a valid range for good inputs', () => {
    const r = parseCustomRange('2026-04-01', '2026-04-30')
    expect(r).not.toBeNull()
    expect(r!.from.toISOString().slice(0, 10)).toBe('2026-04-01')
  })
})
