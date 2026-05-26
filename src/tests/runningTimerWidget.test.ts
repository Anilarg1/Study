import { describe, it, expect } from 'vitest'
import { formatMMSS, calcProgress } from '../components/RightRail'

describe('formatMMSS', () => {
  it('formats zero as 00:00', () => {
    expect(formatMMSS(0)).toBe('00:00')
  })

  it('pads minutes and seconds to two digits', () => {
    expect(formatMMSS(90)).toBe('01:30')   // 1 min 30 sec
    expect(formatMMSS(65)).toBe('01:05')   // leading zero on seconds
  })

  it('handles a full 25-minute session', () => {
    expect(formatMMSS(1500)).toBe('25:00')
  })

  it('handles 59:59 without overflow', () => {
    expect(formatMMSS(3599)).toBe('59:59')
  })

  it('guards against float inputs by rounding', () => {
    expect(formatMMSS(90.7)).toBe('01:31')
  })

  it('guards against negative inputs by clamping to zero', () => {
    expect(formatMMSS(-1)).toBe('00:00')
  })
})

describe('calcProgress', () => {
  it('returns 0 when nothing has elapsed (full remaining)', () => {
    expect(calcProgress(1500, 1500)).toBe(0)
  })

  it('returns 1 when fully elapsed (zero remaining)', () => {
    expect(calcProgress(0, 1500)).toBe(1)
  })

  it('returns 0.5 at the halfway point', () => {
    expect(calcProgress(750, 1500)).toBe(0.5)
  })

  it('returns 0 when total is 0 (guard against division by zero)', () => {
    expect(calcProgress(0, 0)).toBe(0)
  })

  it('clamps to 0 when remaining exceeds total', () => {
    // e.g. duration was changed after the timer started
    expect(calcProgress(1600, 1500)).toBe(0)
  })

  it('guards against NaN total by returning 0', () => {
    expect(calcProgress(750, NaN)).toBe(0)
  })

  it('guards against Infinity total by returning 0', () => {
    expect(calcProgress(750, Infinity)).toBe(0)
  })
})
