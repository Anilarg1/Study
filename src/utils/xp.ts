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
