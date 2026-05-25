import { describe, it, expect } from 'vitest'
import { fmtMins, dateOf, toLocalDateStr } from '../utils/date'

describe('toLocalDateStr', () => {
  it('formats a Date as YYYY-MM-DD in local time', () => {
    const d = new Date(2026, 4, 25) // May 25 2026, local midnight
    expect(toLocalDateStr(d)).toBe('2026-05-25')
  })

  it('defaults to today when called with no argument', () => {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    expect(toLocalDateStr()).toBe(`${y}-${m}-${d}`)
  })
})

describe('dateOf', () => {
  it('extracts a local date string from an ISO timestamp', () => {
    const localMidnight = new Date(2026, 4, 25, 0, 0, 0)
    expect(dateOf(localMidnight.toISOString())).toBe('2026-05-25')
  })
})

describe('fmtMins', () => {
  it('formats 0 minutes', ()  => expect(fmtMins(0)).toBe('0m'))
  it('formats minutes only', () => expect(fmtMins(45)).toBe('45m'))
  it('formats hours only',   () => expect(fmtMins(120)).toBe('2h'))
  it('formats h and m',      () => expect(fmtMins(90)).toBe('1h 30m'))
  it('zero-pads minutes',    () => expect(fmtMins(65)).toBe('1h 05m'))
})
