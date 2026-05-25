import type { SessionEntry } from '../types'

/** 'YYYY-MM-DD' in the user's local timezone. */
export function toLocalDateStr(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Extract 'YYYY-MM-DD' from an ISO timestamp string. */
export function dateOf(iso: string): string {
  return toLocalDateStr(new Date(iso))
}

/** Format minutes as "2h 05m", "45m", "2h", or "0m". */
export function fmtMins(totalMins: number): string {
  if (totalMins === 0) return '0m'
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

/** Alias of fmtMins — kept for call-site clarity. */
export const fmtMinsShort = fmtMins

/**
 * Session duration in whole minutes.
 * Returns 0 (not 25) when durationSecs is null — callers must not assume a default.
 */
export function sessionMins(s: Pick<SessionEntry, 'durationSecs'>): number {
  return s.durationSecs != null ? Math.round(s.durationSecs / 60) : 0
}
