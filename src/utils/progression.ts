// ─── Types ───────────────────────────────────────────────────────────────────

export interface RankTier {
  rankIndex: number    // 0–29
  tierIndex: number    // 0–9 (which named tier)
  tierName:  string    // e.g. 'Scholar'
  subLevel:  1 | 2 | 3
  minXP:     number
  color:     string    // primary badge color
}

export interface RankInfo extends RankTier {
  label: string   // e.g. 'Scholar II'
}

export interface MasteryTier {
  index:  number  // 0–4
  name:   string  // 'Ember' | 'Kindled' | 'Burning' | 'Blazing' | 'Inferno'
  minXP:  number
  color:  string
}

export interface MasteryInfo extends MasteryTier {
  subjectXP: number
}

// ─── Rank Tiers ──────────────────────────────────────────────────────────────

const TIER_NAMES: string[] = [
  'Wanderer', 'Seeker', 'Initiate', 'Apprentice', 'Scholar',
  'Adept', 'Savant', 'Sage', 'Master', 'Luminary',
]

const TIER_COLORS: string[] = [
  '#64748b',  // Wanderer  — slate
  '#38bdf8',  // Seeker    — blue
  '#818cf8',  // Initiate  — indigo
  '#a78bfa',  // Apprentice — purple
  '#c084fc',  // Scholar   — violet
  '#e879f9',  // Adept     — fuchsia
  '#f472b6',  // Savant    — pink
  '#fb923c',  // Sage      — orange
  '#fbbf24',  // Master    — gold
  '#fef08a',  // Luminary  — bright gold
]

// [tierIndex][subLevel-1] = minXP
const XP_TABLE: [number, number, number][] = [
  [    0,    800,   1500],  // Wanderer  I/II/III  (~0/8/15h)
  [ 2500,   3800,   5400],  // Seeker    I/II/III  (~25/38/54h)
  [ 7500,  10000,  13000],  // Initiate  I/II/III  (~75/100/130h)
  [16500,  20500,  25000],  // Apprentice I/II/III (~165/205/250h)
  [30000,  35500,  41500],  // Scholar   I/II/III  (~300/355/415h)
  [48000,  56000,  65000],  // Adept     I/II/III  (~480/560/650h)
  [80000,  97500, 115000],  // Savant    I/II/III  (~800/975/1150h)
  [135000,158000, 183000],  // Sage      I/II/III  (~1350/1580/1830h)
  [210000,240000, 270000],  // Master    I/II/III  (~2100/2400/2700h)
  [300000,340000, 380000],  // Luminary  I/II/III  (~3000/3400/3800h)
]

export const RANK_TIERS: RankTier[] = XP_TABLE.flatMap(([i1, i2, i3], tierIndex) =>
  ([i1, i2, i3] as [number, number, number]).map((minXP, subIdx) => ({
    rankIndex: tierIndex * 3 + subIdx,
    tierIndex,
    tierName:  TIER_NAMES[tierIndex] ?? '',
    subLevel:  (subIdx + 1) as 1 | 2 | 3,
    minXP,
    color:     TIER_COLORS[tierIndex] ?? '',
  }))
)

// ─── Mastery Tiers ───────────────────────────────────────────────────────────

export const MASTERY_TIERS: MasteryTier[] = [
  { index: 0, name: 'Ember',   minXP:     0, color: '#78716c' },
  { index: 1, name: 'Kindled', minXP:  1000, color: '#fb923c' },
  { index: 2, name: 'Burning', minXP:  3000, color: '#fbbf24' },
  { index: 3, name: 'Blazing', minXP:  7500, color: '#fef08a' },
  { index: 4, name: 'Inferno', minXP: 15000, color: '#ffffff' },
]

// ─── Lookup functions ────────────────────────────────────────────────────────

/** Return the current rank for a given total XP value. */
export function getRankFromXP(totalXP: number): RankInfo {
  let rank = RANK_TIERS[0] as RankTier
  for (const tier of RANK_TIERS) {
    if (totalXP >= tier.minXP) rank = tier
    else break
  }
  const romanLabels: ('I' | 'II' | 'III')[] = ['I', 'II', 'III']
  return { ...rank, label: `${rank.tierName} ${romanLabels[rank.subLevel - 1] ?? 'I'}` }
}

/** Return the mastery tier for a given subject XP value. */
export function getMasteryFromXP(subjectXP: number): MasteryInfo {
  let mastery = MASTERY_TIERS[0] as MasteryTier
  for (const tier of MASTERY_TIERS) {
    if (subjectXP >= tier.minXP) mastery = tier
    else break
  }
  return { ...mastery, subjectXP }
}

/** XP needed to reach the next rank. Returns 0 at Luminary III. */
export function getXPToNextRank(totalXP: number): number {
  const current = getRankFromXP(totalXP)
  if (current.rankIndex >= RANK_TIERS.length - 1) return 0
  const nextTier = RANK_TIERS[current.rankIndex + 1]
  if (!nextTier) return 0
  return nextTier.minXP - totalXP
}

/** Progress within the current rank (0–1). */
export function getRankProgress(totalXP: number): number {
  const current = getRankFromXP(totalXP)
  if (current.rankIndex >= RANK_TIERS.length - 1) return 1
  const next = RANK_TIERS[current.rankIndex + 1]
  if (!next) return 1
  return (totalXP - current.minXP) / (next.minXP - current.minXP)
}
