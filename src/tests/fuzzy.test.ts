import { describe, it, expect } from 'vitest'
import { fuzzyScore } from '../components/CommandPalette'

describe('fuzzyScore', () => {
  it('returns -1 for non-matching query', () => {
    expect(fuzzyScore('xyz', 'Mathematics')).toBe(-1)
  })
  it('matches partial subsequence', () => {
    expect(fuzzyScore('mth', 'Mathematics')).toBeGreaterThan(-1)
  })
  it('prefix match scores higher than subsequence', () => {
    const prefix = fuzzyScore('ma', 'Mathematics')
    const sub    = fuzzyScore('ma', 'Grammar')
    expect(prefix).toBeGreaterThan(sub)
  })
  it('exact match scores highest', () => {
    expect(fuzzyScore('mathematics', 'Mathematics')).toBeGreaterThan(fuzzyScore('mth', 'Mathematics'))
  })
})
