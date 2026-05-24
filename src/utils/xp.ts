import type { TimerMode } from '../types'

/**
 * XP / leveling utilities.
 * Level formula: floor(sqrt(xp / 100))
 *
 * XP awarded per completed session:
 *   work        → 25 XP
 *   short break → 5  XP
 *   long break  → 10 XP
 */

export const XP_REWARDS: Record<TimerMode, number> = {
  work:        25,
  shortBreak:  5,
  longBreak:   10,
}

/** Current level from total XP */
export function xpToLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100))
}

/** Total XP required to reach a given level */
export function levelToXp(level: number): number {
  return level * level * 100
}

/** XP progress within the current level (0–1) */
export function xpProgress(xp: number): number {
  const level   = xpToLevel(xp)
  const current = levelToXp(level)
  const next    = levelToXp(level + 1)
  return (xp - current) / (next - current)
}

/** XP needed to reach the next level from current total */
export function xpToNextLevel(xp: number): number {
  const level = xpToLevel(xp)
  return levelToXp(level + 1) - xp
}

/**
 * Duration-proportional XP for a work session.
 *   < 25 min  → 1 XP per minute (flat)
 *   ≥ 25 min  → floor(mins^1.5 / 5)   (super-linear, continuous at threshold)
 *
 * Input: durationSecs (seconds). Returns integer XP.
 */
export function calcSessionXP(durationSecs: number): number {
  if (durationSecs <= 0) return 0
  const mins = durationSecs / 60
  if (mins < 25) return Math.floor(mins)
  return Math.floor(Math.pow(mins, 1.5) / 5)
}

/**
 * Streak multiplier applied on top of calcSessionXP.
 *   1–2  days → 1.0×
 *   3–6  days → 1.2×
 *   7–29 days → 1.5×
 *   30+  days → 2.0×
 */
export function getStreakMultiplier(streakDays: number): number {
  if (streakDays >= 30) return 2
  if (streakDays >= 7)  return 1.5
  if (streakDays >= 3)  return 1.2
  return 1
}
