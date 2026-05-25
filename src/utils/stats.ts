const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Find the best consecutive 7-day window in a Map of date-string → minutes.
 * O(d log d) two-pointer sliding window — replaces the previous O(d²) approach.
 */
export function bestWeek(
  minsPerDay: Map<string, number>,
): { bestWeekMins: number; bestWeekStart: string } {
  if (minsPerDay.size === 0) return { bestWeekMins: 0, bestWeekStart: '' }

  const entries = [...minsPerDay.entries()]
    .map(([ds, mins]) => ({ ds, mins, ts: new Date(`${ds}T00:00`).getTime() }))
    .sort((a, b) => a.ts - b.ts)

  let bestWeekMins = 0
  let bestWeekStart = ''
  let windowMins = 0
  let left = 0

  for (let right = 0; right < entries.length; right++) {
    const rightEntry = entries[right]!
    windowMins += rightEntry.mins

    // Shrink: drop days that start a window more than 7 days before rightEntry
    while (rightEntry.ts - entries[left]!.ts >= WEEK_MS) {
      windowMins -= entries[left]!.mins
      left++
    }

    if (windowMins > bestWeekMins) {
      bestWeekMins = windowMins
      bestWeekStart = entries[left]!.ds
    }
  }

  return { bestWeekMins, bestWeekStart }
}
