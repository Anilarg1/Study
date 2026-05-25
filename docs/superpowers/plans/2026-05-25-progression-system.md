# Progression System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat XP system with a dual-axis MMO-style progression system — a 30-rank global Scholar path and a 5-tier per-subject Flame mastery system — driven by a duration-proportional XP formula with a streak multiplier.

**Architecture:** A new `src/utils/progression.ts` holds all pure rank/mastery logic and constants. `useXPStore` gains the new formula and calls a new `useSubjectMasteryStore` on every work session. Rank-up info flows back through `AwardResult` to `PomodoroTimer`, which triggers `RankUpToast`. UI components (`Sidebar`, `RightRail`, `StatsPage`) read from both stores via selectors.

**Tech Stack:** React 19, TypeScript, Zustand, Supabase (PostgreSQL), Tailwind CSS, Vitest (new — must be installed), inline SVG for badges.

**Spec:** `docs/superpowers/specs/2026-05-25-progression-system-design.md`

---

## File Map

| Status | Path | Role |
|---|---|---|
| **New** | `src/utils/progression.ts` | Rank/mastery constants, pure lookup functions |
| **New** | `src/store/useSubjectMasteryStore.ts` | Zustand store for per-subject XP |
| **New** | `src/components/RankBadge.tsx` | SVG badge for global rank tiers |
| **New** | `src/components/MasteryBadge.tsx` | SVG badge for flame mastery tiers |
| **New** | `src/components/RankUpToast.tsx` | Rank-up notification toast |
| **New** | `supabase/migrations/20260525000000_subject_xp.sql` | DB migration for subject_xp table |
| **New** | `src/tests/xp.test.ts` | Unit tests for XP formula |
| **New** | `src/tests/progression.test.ts` | Unit tests for rank/mastery logic |
| **Modify** | `src/utils/xp.ts` | Add `calcSessionXP`, `getStreakMultiplier` |
| **Modify** | `src/store/useXPStore.ts` | Use new formula, detect rank-ups, wire mastery store |
| **Modify** | `src/lib/supabase.ts` | Add subject XP helpers |
| **Modify** | `src/components/PomodoroTimer.tsx` | Use rank-up result from awardXP |
| **Modify** | `src/components/Sidebar.tsx` | Add rank widget + mastery on subject rows |
| **Modify** | `src/components/RightRail.tsx` | Replace LevelCard with RankCard |
| **Modify** | `src/App.tsx` | Mount RankUpToast globally |
| **Modify** | `src/pages/StatsPage.tsx` | Add Progression card |

---

## Task 1: Install Vitest

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/tests/setup.ts`

- [ ] **Step 1: Install vitest and jsdom**

```bash
npm install --save-dev vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Add test script to package.json**

Open `package.json` and add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Configure vitest in vite.config.ts**

Replace `vite.config.ts` entirely with:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
  },
})
```

- [ ] **Step 4: Create test setup file**

Create `src/tests/setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Verify vitest runs (no tests yet)**

```bash
npm test
```
Expected output: `No test files found` or `0 tests passed`.

- [ ] **Step 6: Commit**

```bash
git add package.json vite.config.ts src/tests/setup.ts
git commit -m "chore: install vitest + jsdom for unit testing"
```

---

## Task 2: New XP Formula

**Files:**
- Modify: `src/utils/xp.ts`
- Create: `src/tests/xp.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/tests/xp.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { calcSessionXP, getStreakMultiplier } from '../utils/xp'

describe('calcSessionXP', () => {
  it('awards 1 XP/min for sessions under 25 min', () => {
    expect(calcSessionXP(0)).toBe(0)
    expect(calcSessionXP(60)).toBe(1)       // 1 min
    expect(calcSessionXP(600)).toBe(10)     // 10 min
    expect(calcSessionXP(1440)).toBe(24)    // 24 min
  })

  it('awards exactly 25 XP at the 25-min threshold', () => {
    expect(calcSessionXP(1500)).toBe(25)    // 25 min exactly
  })

  it('awards super-linear XP for sessions over 25 min', () => {
    expect(calcSessionXP(3000)).toBe(71)    // 50 min
    expect(calcSessionXP(5400)).toBe(171)   // 90 min
    expect(calcSessionXP(7200)).toBe(263)   // 120 min
  })

  it('floors to integer', () => {
    expect(Number.isInteger(calcSessionXP(1800))).toBe(true) // 30 min
  })
})

describe('getStreakMultiplier', () => {
  it('returns 1 for streaks 0-2', () => {
    expect(getStreakMultiplier(0)).toBe(1)
    expect(getStreakMultiplier(1)).toBe(1)
    expect(getStreakMultiplier(2)).toBe(1)
  })

  it('returns 1.2 for streaks 3-6', () => {
    expect(getStreakMultiplier(3)).toBe(1.2)
    expect(getStreakMultiplier(6)).toBe(1.2)
  })

  it('returns 1.5 for streaks 7-29', () => {
    expect(getStreakMultiplier(7)).toBe(1.5)
    expect(getStreakMultiplier(29)).toBe(1.5)
  })

  it('returns 2 for streaks 30+', () => {
    expect(getStreakMultiplier(30)).toBe(2)
    expect(getStreakMultiplier(100)).toBe(2)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```
Expected: FAIL — `calcSessionXP` and `getStreakMultiplier` not found.

- [ ] **Step 3: Add new functions to src/utils/xp.ts**

Add to the bottom of `src/utils/xp.ts` (keep all existing functions — they are still used by XPBar, RightRail, GoalsPanel and will be cleaned up in later tasks):
```typescript
/**
 * Duration-proportional XP for a work session.
 *   < 25 min  → 1 XP per minute (flat)
 *   ≥ 25 min  → floor(mins^1.5 / 5)   (super-linear, continuous at threshold)
 *
 * Input: durationSecs (seconds). Returns integer XP.
 */
export function calcSessionXP(durationSecs: number): number {
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/xp.ts src/tests/xp.test.ts
git commit -m "feat(xp): add duration-proportional formula and streak multiplier"
```

---

## Task 3: Progression Constants and Logic

**Files:**
- Create: `src/utils/progression.ts`
- Create: `src/tests/progression.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/tests/progression.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import {
  getRankFromXP,
  getMasteryFromXP,
  getXPToNextRank,
  RANK_TIERS,
  MASTERY_TIERS,
} from '../utils/progression'

describe('RANK_TIERS', () => {
  it('has 30 entries (10 tiers × 3 sub-levels)', () => {
    expect(RANK_TIERS.length).toBe(30)
  })

  it('first rank starts at 0 XP', () => {
    expect(RANK_TIERS[0].minXP).toBe(0)
  })

  it('thresholds are strictly ascending', () => {
    for (let i = 1; i < RANK_TIERS.length; i++) {
      expect(RANK_TIERS[i].minXP).toBeGreaterThan(RANK_TIERS[i - 1].minXP)
    }
  })
})

describe('MASTERY_TIERS', () => {
  it('has 5 entries', () => {
    expect(MASTERY_TIERS.length).toBe(5)
  })

  it('first mastery tier starts at 0 XP', () => {
    expect(MASTERY_TIERS[0].minXP).toBe(0)
  })
})

describe('getRankFromXP', () => {
  it('returns Wanderer I for 0 XP', () => {
    const r = getRankFromXP(0)
    expect(r.tierName).toBe('Wanderer')
    expect(r.subLevel).toBe(1)
    expect(r.rankIndex).toBe(0)
  })

  it('returns correct rank at exact threshold', () => {
    const threshold = RANK_TIERS[1].minXP
    const r = getRankFromXP(threshold)
    expect(r.rankIndex).toBe(1)
  })

  it('returns Luminary III at very high XP', () => {
    const r = getRankFromXP(999_999_999)
    expect(r.tierName).toBe('Luminary')
    expect(r.subLevel).toBe(3)
    expect(r.rankIndex).toBe(29)
  })
})

describe('getMasteryFromXP', () => {
  it('returns Ember for 0 subject XP', () => {
    expect(getMasteryFromXP(0).name).toBe('Ember')
  })

  it('returns Inferno for 15000+ subject XP', () => {
    expect(getMasteryFromXP(15000).name).toBe('Inferno')
    expect(getMasteryFromXP(999999).name).toBe('Inferno')
  })
})

describe('getXPToNextRank', () => {
  it('returns positive XP needed when not at max rank', () => {
    expect(getXPToNextRank(0)).toBeGreaterThan(0)
  })

  it('returns 0 when already at Luminary III', () => {
    expect(getXPToNextRank(999_999_999)).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```
Expected: FAIL — `progression` module not found.

- [ ] **Step 3: Create src/utils/progression.ts**

```typescript
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
//
// XP thresholds assume ~100 XP per qualifying study hour (base formula,
// no streak bonus). Pacing is front-loaded: early tiers are fast (~1 week),
// late tiers are slow grind (~years).
//
// Hours → XP conversion: hours × 100

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
    tierName:  TIER_NAMES[tierIndex],
    subLevel:  (subIdx + 1) as 1 | 2 | 3,
    minXP,
    color:     TIER_COLORS[tierIndex],
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
  let rank = RANK_TIERS[0]
  for (const tier of RANK_TIERS) {
    if (totalXP >= tier.minXP) rank = tier
    else break
  }
  return { ...rank, label: `${rank.tierName} ${['I','II','III'][rank.subLevel - 1]}` }
}

/** Return the mastery tier for a given subject XP value. */
export function getMasteryFromXP(subjectXP: number): MasteryInfo {
  let mastery = MASTERY_TIERS[0]
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
  return RANK_TIERS[current.rankIndex + 1].minXP - totalXP
}

/** Progress within the current rank (0–1). */
export function getRankProgress(totalXP: number): number {
  const current = getRankFromXP(totalXP)
  if (current.rankIndex >= RANK_TIERS.length - 1) return 1
  const next = RANK_TIERS[current.rankIndex + 1]
  return (totalXP - current.minXP) / (next.minXP - current.minXP)
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/progression.ts src/tests/progression.test.ts
git commit -m "feat(progression): add rank/mastery constants and lookup functions"
```

---

## Task 4: Supabase Migration — subject_xp Table

**Files:**
- Create: `supabase/migrations/20260525000000_subject_xp.sql`

- [ ] **Step 1: Create migrations directory and SQL file**

```bash
mkdir -p supabase/migrations
```

Create `supabase/migrations/20260525000000_subject_xp.sql`:
```sql
-- subject_xp: tracks per-user, per-subject XP totals for mastery tiers
create table if not exists public.subject_xp (
  user_id    uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  xp         integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, subject_id)
);

-- RLS: users can only read/write their own rows
alter table public.subject_xp enable row level security;

create policy "Users can read own subject_xp"
  on public.subject_xp for select
  using (auth.uid() = user_id);

create policy "Users can upsert own subject_xp"
  on public.subject_xp for insert
  with check (auth.uid() = user_id);

create policy "Users can update own subject_xp"
  on public.subject_xp for update
  using (auth.uid() = user_id);

-- Index for fast per-user lookups
create index if not exists subject_xp_user_id_idx on public.subject_xp(user_id);
```

- [ ] **Step 2: Apply migration in Supabase dashboard**

Open the Supabase dashboard → SQL Editor → paste the file contents → Run.

Verify: the `subject_xp` table appears in Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260525000000_subject_xp.sql
git commit -m "feat(db): add subject_xp table with RLS policies"
```

---

## Task 5: Supabase Helper Functions

**Files:**
- Modify: `src/lib/supabase.ts`

- [ ] **Step 1: Add subject XP helpers at the bottom of src/lib/supabase.ts**

```typescript
// ─── Subject XP helpers ───────────────────────────────────────────────────────

/** Fetch all subject XP rows for a user. */
export async function fetchSubjectXP(
  userId: string,
): Promise<{ data: { subjectId: string; xp: number }[]; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('subject_xp')
    .select('subject_id, xp')
    .eq('user_id', userId)
  if (error || !data) return { data: [], error }
  return {
    data: data.map(r => ({ subjectId: r.subject_id as string, xp: r.xp as number })),
    error: null,
  }
}

/**
 * Upsert the total XP for a subject (overwrites, does not increment).
 * Call fire-and-forget after updating local state.
 */
export async function upsertSubjectXP(
  userId: string,
  subjectId: string,
  totalXP: number,
): Promise<PostgrestError | null> {
  const { error } = await supabase
    .from('subject_xp')
    .upsert(
      { user_id: userId, subject_id: subjectId, xp: totalXP, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,subject_id' },
    )
  return error
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat(supabase): add fetchSubjectXP and upsertSubjectXP helpers"
```

---

## Task 6: Subject Mastery Zustand Store

**Files:**
- Create: `src/store/useSubjectMasteryStore.ts`

- [ ] **Step 1: Create the store**

Create `src/store/useSubjectMasteryStore.ts`:
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { fetchSubjectXP, upsertSubjectXP } from '../lib/supabase'
import { getCurrentUserId } from '../lib/currentUser'

interface SubjectMasteryState {
  /** Map of subjectId → total XP earned in that subject */
  subjectXP: Record<string, number>

  /**
   * Add XP to a subject's mastery pool.
   * Only call for work sessions with a non-null subjectId.
   */
  addSubjectXP(subjectId: string, xp: number): void

  /** Called on sign-in to hydrate from Supabase. */
  _importFromSupabase(data: { subjectId: string; xp: number }[]): void

  _reset(): void
}

const useSubjectMasteryStore = create<SubjectMasteryState>()(
  persist(
    (set, get) => ({
      subjectXP: {},

      addSubjectXP(subjectId, xp) {
        const prev    = get().subjectXP[subjectId] ?? 0
        const newTotal = prev + xp
        set(state => ({
          subjectXP: { ...state.subjectXP, [subjectId]: newTotal },
        }))
        const userId = getCurrentUserId()
        if (userId) {
          upsertSubjectXP(userId, subjectId, newTotal).catch(console.error)
        }
      },

      _importFromSupabase(data) {
        // Merge Supabase values with local, keeping the higher of the two
        set(state => {
          const merged = { ...state.subjectXP }
          for (const { subjectId, xp } of data) {
            merged[subjectId] = Math.max(merged[subjectId] ?? 0, xp)
          }
          return { subjectXP: merged }
        })
      },

      _reset() {
        set({ subjectXP: {} })
      },
    }),
    {
      name: 'notebook-subject-mastery',
      version: 1,
      partialize: (state): Partial<SubjectMasteryState> => ({
        subjectXP: state.subjectXP,
      }),
    }
  )
)

export default useSubjectMasteryStore
```

- [ ] **Step 2: Wire import into auth init (src/store/useAuthStore.ts)**

Open `src/store/useAuthStore.ts`. Find where `fetchSubjects`, `fetchSessions`, and other Supabase hydration calls happen after sign-in, and add subject mastery hydration alongside them. Look for a pattern like `fetchUserXP` being called — add after it:

```typescript
import { fetchSubjectXP } from '../lib/supabase'
import useSubjectMasteryStore from './useSubjectMasteryStore'

// Inside the auth init block, after other fetches:
fetchSubjectXP(userId).then(({ data }) => {
  if (data.length) useSubjectMasteryStore.getState()._importFromSupabase(data)
})
```

- [ ] **Step 3: Wire reset on sign-out**

In the same `useAuthStore.ts`, in the sign-out handler, add:
```typescript
useSubjectMasteryStore.getState()._reset()
```

- [ ] **Step 4: Commit**

```bash
git add src/store/useSubjectMasteryStore.ts src/store/useAuthStore.ts
git commit -m "feat(store): add useSubjectMasteryStore with Supabase persistence"
```

---

## Task 7: Update useXPStore — New Formula + Rank-up Detection

**Files:**
- Modify: `src/store/useXPStore.ts`

- [ ] **Step 1: Update AwardResult type and awardXP in useXPStore.ts**

Replace the entire file content:
```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { calcSessionXP, getStreakMultiplier, XP_REWARDS } from '../utils/xp'
import { getRankFromXP } from '../utils/progression'
import { insertSession, upsertUserXP } from '../lib/supabase'
import { getCurrentUserId } from '../lib/currentUser'
import useSubjectMasteryStore from './useSubjectMasteryStore'
import useStreakStore, { calcCurrentStreak } from './useStreakStore'
import type { TimerMode, SessionEntry } from '../types'
import type { RankInfo } from '../utils/progression'

const MAX_LOCAL_SESSIONS = 200

export interface AwardResult {
  xp:        number
  leveledUp: boolean   // kept for backward compat — true when rank tier changes
  newLevel:  number    // kept for backward compat — rankIndex of new rank
  rankUp:    { previous: RankInfo; current: RankInfo } | null
}

interface XPState {
  totalXP:  number
  sessions: SessionEntry[]

  awardXP(
    sessionType:   TimerMode,
    subjectId?:    string | null,
    durationSecs?: number | null,
    tagId?:        string | null,
  ): AwardResult
  _importFromSupabase(xp: number): void
  _importSessionsFromSupabase(sessions: SessionEntry[]): void
  _reset(): void
}

const useXPStore = create<XPState>()(
  persist(
    (set, get) => ({
      totalXP:  0,
      sessions: [],

      awardXP(sessionType, subjectId = null, durationSecs = null, tagId = null) {
        // ── Calculate XP ──────────────────────────────────────────────────
        let xp: number
        if (sessionType === 'work' && durationSecs != null) {
          const loginDates    = useStreakStore.getState().loginDates
          const streak        = calcCurrentStreak(new Set(loginDates))
          const multiplier    = getStreakMultiplier(streak)
          xp = Math.floor(calcSessionXP(durationSecs) * multiplier)
        } else {
          // breaks stay flat
          xp = XP_REWARDS[sessionType] ?? 0
        }

        // ── Rank before / after ───────────────────────────────────────────
        const prevXP   = get().totalXP
        const newXP    = prevXP + xp
        const prevRank = getRankFromXP(prevXP)
        const newRank  = getRankFromXP(newXP)
        const rankUp   = newRank.rankIndex > prevRank.rankIndex
          ? { previous: prevRank, current: newRank }
          : null

        // ── Update local state ────────────────────────────────────────────
        const entry: SessionEntry = {
          id:           crypto.randomUUID(),
          type:         sessionType,
          completedAt:  new Date().toISOString(),
          xp,
          subjectId:    subjectId    ?? null,
          tagId:        tagId        ?? null,
          durationSecs: durationSecs ?? null,
        }

        set(state => ({
          totalXP:  newXP,
          sessions: [...state.sessions, entry].slice(-MAX_LOCAL_SESSIONS),
        }))

        // ── Award subject mastery (work sessions with a subject only) ─────
        if (sessionType === 'work' && subjectId) {
          useSubjectMasteryStore.getState().addSubjectXP(subjectId, xp)
        }

        // ── Persist to Supabase ───────────────────────────────────────────
        const userId = getCurrentUserId()
        if (userId) {
          insertSession(userId, entry).catch(console.error)
          upsertUserXP(userId, newXP).catch(console.error)
        }

        return {
          xp,
          leveledUp: rankUp?.current.tierIndex !== rankUp?.previous.tierIndex ?? false,
          newLevel:  newRank.rankIndex,
          rankUp,
        }
      },

      _importFromSupabase(xp) {
        set(state => ({ totalXP: Math.max(state.totalXP, xp) }))
      },

      _importSessionsFromSupabase(sessions) {
        const toStore = [...sessions].reverse().slice(0, MAX_LOCAL_SESSIONS)
        set({ sessions: toStore })
      },

      _reset() {
        set({ totalXP: 0, sessions: [] })
      },
    }),
    {
      name:    'notebook-xp',
      version: 2,   // bumped: formula changed, local XP reset on upgrade
      partialize: (state): Partial<XPState> => ({
        totalXP:  state.totalXP,
        sessions: state.sessions,
      }),
    }
  )
)

export default useXPStore
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/store/useXPStore.ts
git commit -m "feat(store): use duration-proportional XP formula with streak multiplier and rank-up detection"
```

---

## Task 8: Historical Migration

**Files:**
- Create: `supabase/migrations/20260525000001_recalculate_xp.sql`

- [ ] **Step 1: Create the migration SQL**

Create `supabase/migrations/20260525000001_recalculate_xp.sql`:
```sql
-- Recalculate XP for all historical sessions using the new formula.
-- Base formula only (no streak multiplier — cannot retroactively know streak state).
-- Sessions with duration_secs IS NULL keep their existing XP.
--
-- Formula:
--   work sessions, duration < 25 min  → floor(duration_mins)
--   work sessions, duration >= 25 min → floor(duration_mins^1.5 / 5)
--   short_break → 5 XP (unchanged)
--   long_break  → 10 XP (unchanged)

update public.sessions
set xp = case
  when type != 'work' then xp   -- keep break XP unchanged
  when duration_secs is null    then xp   -- no duration, keep legacy
  when duration_secs / 60.0 < 25
    then floor(duration_secs / 60.0)::integer
  else
    floor(power(duration_secs / 60.0, 1.5) / 5)::integer
end
where type = 'work';

-- Recalculate each user's total XP from their updated sessions
update public.users u
set xp = (
  select coalesce(sum(s.xp), 0)
  from public.sessions s
  where s.user_id = u.id
);

-- Backfill subject_xp from historical work sessions with a subject_id
insert into public.subject_xp (user_id, subject_id, xp, updated_at)
select
  user_id,
  subject_id,
  sum(xp)::integer as xp,
  now()
from public.sessions
where type = 'work'
  and subject_id is not null
group by user_id, subject_id
on conflict (user_id, subject_id)
do update set
  xp         = excluded.xp,
  updated_at = excluded.updated_at;
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Paste contents into Supabase dashboard → SQL Editor → Run.

Verify by checking a few session rows: `select id, duration_secs, xp from sessions limit 10;`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260525000001_recalculate_xp.sql
git commit -m "feat(db): recalculate historical XP and backfill subject_xp"
```

---

## Task 9: RankBadge Component

**Files:**
- Create: `src/components/RankBadge.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/RankBadge.tsx`:
```tsx
/**
 * RankBadge — angular metallic SVG badge for each of the 10 Scholar rank tiers.
 * Props:
 *   tierIndex  0–9 (which named tier: Wanderer → Luminary)
 *   size       pixel size for width/height (default 40)
 *   subLevel   1|2|3 — controls pip dots shown below badge
 *   showPips   show sub-level pip dots (default true)
 */

interface RankBadgeProps {
  tierIndex: number
  size?:     number
  subLevel?: 1 | 2 | 3
  showPips?: boolean
}

function WandererBadge()  { return (
  <g>
    <polygon points="50,6 94,50 50,94 6,50" fill="#0d1117" stroke="#475569" strokeWidth="1.5"/>
    <polygon points="50,18 82,50 50,82 18,50" fill="#475569" fillOpacity="0.1"/>
    <line x1="50" y1="18" x2="50" y2="82" stroke="#475569" strokeWidth="1" strokeOpacity="0.5"/>
    <line x1="18" y1="50" x2="82" y2="50" stroke="#475569" strokeWidth="1" strokeOpacity="0.5"/>
    <polygon points="50,42 58,50 50,58 42,50" fill="#64748b"/>
    <polygon points="50,46 54,50 50,54 46,50" fill="#94a3b8"/>
  </g>
)}

function SeekerBadge() {
  return (
    <g>
      <defs>
        <filter id="sf-s"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <polygon points="50,5 78,18 95,50 78,82 50,95 22,82 5,50 22,18" fill="#0d1117" stroke="#0369a1" strokeWidth="1.5" filter="url(#sf-s)"/>
      <polygon points="50,15 70,24 82,50 70,76 50,85 30,76 18,50 30,24" fill="#38bdf8" fillOpacity="0.08"/>
      <line x1="22" y1="18" x2="78" y2="82" stroke="#38bdf8" strokeWidth="0.8" strokeOpacity="0.3"/>
      <line x1="78" y1="18" x2="22" y2="82" stroke="#38bdf8" strokeWidth="0.8" strokeOpacity="0.3"/>
      <polyline points="36,56 50,36 64,56" fill="none" stroke="#7dd3fc" strokeWidth="2.5" strokeLinejoin="miter" filter="url(#sf-s)"/>
      <polyline points="36,65 50,45 64,65" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeLinejoin="miter" strokeOpacity="0.5"/>
    </g>
  )
}

function InitiateBadge() {
  return (
    <g>
      <defs>
        <filter id="if-i"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="ig-i" x1="15%" y1="5%" x2="85%" y2="95%"><stop offset="0%" stopColor="#a5b4fc"/><stop offset="100%" stopColor="#3730a3"/></linearGradient>
      </defs>
      <polygon points="10,10 90,10 90,58 50,92 10,58" fill="#0d1117" stroke="#4f46e5" strokeWidth="1.5" filter="url(#if-i)"/>
      <polygon points="18,18 82,18 82,55 50,82 18,55" fill="url(#ig-i)" fillOpacity="0.1"/>
      <line x1="10" y1="22" x2="90" y2="22" stroke="#818cf8" strokeWidth="1" strokeOpacity="0.4"/>
      <polyline points="18,18 28,18 28,26" fill="none" stroke="#818cf8" strokeWidth="1.5" strokeOpacity="0.6"/>
      <polyline points="82,18 72,18 72,26" fill="none" stroke="#818cf8" strokeWidth="1.5" strokeOpacity="0.6"/>
      <polygon points="50,32 66,62 34,62" fill="none" stroke="#a5b4fc" strokeWidth="2" filter="url(#if-i)"/>
      <line x1="50" y1="32" x2="50" y2="62" stroke="#818cf8" strokeWidth="1" strokeOpacity="0.5"/>
    </g>
  )
}

function ApprenticeBadge() {
  return (
    <g>
      <defs>
        <filter id="apf"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="apg" x1="15%" y1="5%" x2="85%" y2="95%"><stop offset="0%" stopColor="#c4b5fd"/><stop offset="100%" stopColor="#5b21b6"/></linearGradient>
      </defs>
      <polygon points="22,8 42,8 50,16 58,8 78,8 88,18 88,60 50,92 12,60 12,18" fill="#0d1117" stroke="#7c3aed" strokeWidth="1.5" filter="url(#apf)"/>
      <polygon points="26,16 44,16 50,22 56,16 74,16 80,24 80,58 50,82 20,58 20,24" fill="url(#apg)" fillOpacity="0.1"/>
      <line x1="12" y1="30" x2="88" y2="30" stroke="#a78bfa" strokeWidth="0.8" strokeOpacity="0.3"/>
      <line x1="50" y1="16" x2="50" y2="82" stroke="#a78bfa" strokeWidth="0.8" strokeOpacity="0.3"/>
      <polygon points="50,36 64,50 50,64 36,50" fill="none" stroke="#c4b5fd" strokeWidth="2" filter="url(#apf)"/>
      <polygon points="50,42 58,50 50,58 42,50" fill="#a78bfa" fillOpacity="0.7"/>
    </g>
  )
}

function ScholarBadge() {
  return (
    <g>
      <defs>
        <filter id="scf"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="scg" x1="15%" y1="5%" x2="85%" y2="95%"><stop offset="0%" stopColor="#e9d5ff"/><stop offset="100%" stopColor="#6b21a8"/></linearGradient>
      </defs>
      <polygon points="50,5 90,16 90,58 50,95 10,58 10,16" fill="#0d1117" stroke="#9333ea" strokeWidth="1.5" filter="url(#scf)"/>
      <polygon points="50,13 82,22 82,56 50,86 18,56 18,22" fill="url(#scg)" fillOpacity="0.1"/>
      <line x1="10" y1="30" x2="90" y2="30" stroke="#c084fc" strokeWidth="0.8" strokeOpacity="0.35"/>
      <line x1="10" y1="44" x2="90" y2="44" stroke="#c084fc" strokeWidth="0.8" strokeOpacity="0.2"/>
      <polygon points="50,24 55,36 68,36 58,44 62,57 50,50 38,57 42,44 32,36 45,36" fill="none" stroke="#e9d5ff" strokeWidth="1.8" filter="url(#scf)"/>
      <polygon points="50,31 53,39 61,39 55,43 57,51 50,47 43,51 45,43 39,39 47,39" fill="#c084fc" fillOpacity="0.6"/>
    </g>
  )
}

function AdeptBadge() {
  return (
    <g>
      <defs>
        <filter id="adf"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="adg" x1="15%" y1="5%" x2="85%" y2="95%"><stop offset="0%" stopColor="#f0abfc"/><stop offset="100%" stopColor="#86198f"/></linearGradient>
      </defs>
      <polygon points="50,5 82,22 92,50 82,78 50,95 18,78 8,50 18,22" fill="#0d1117" stroke="#d946ef" strokeWidth="1.5" filter="url(#adf)"/>
      <polygon points="50,14 74,27 82,50 74,73 50,86 26,73 18,50 26,27" fill="url(#adg)" fillOpacity="0.1"/>
      <line x1="18" y1="22" x2="82" y2="78" stroke="#e879f9" strokeWidth="0.8" strokeOpacity="0.25"/>
      <line x1="82" y1="22" x2="18" y2="78" stroke="#e879f9" strokeWidth="0.8" strokeOpacity="0.25"/>
      <line x1="8" y1="50" x2="92" y2="50" stroke="#e879f9" strokeWidth="0.8" strokeOpacity="0.25"/>
      <polygon points="50,26 62,44 50,56 38,44" fill="none" stroke="#f0abfc" strokeWidth="2" filter="url(#adf)"/>
      <polygon points="50,44 58,50 50,70 42,50" fill="none" stroke="#f0abfc" strokeWidth="2" filter="url(#adf)"/>
      <polygon points="50,38 56,46 50,52 44,46" fill="#e879f9" fillOpacity="0.8"/>
    </g>
  )
}

function SavantBadge() {
  return (
    <g>
      <defs>
        <filter id="svf"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="svg2" x1="15%" y1="5%" x2="85%" y2="95%"><stop offset="0%" stopColor="#fbcfe8"/><stop offset="100%" stopColor="#9d174d"/></linearGradient>
      </defs>
      <polygon points="50,6 86,18 92,55 76,88 50,95 24,88 8,55 14,18" fill="#0d1117" stroke="#ec4899" strokeWidth="1.5" filter="url(#svf)"/>
      <polygon points="8,55 2,42 14,38 14,55" fill="#0d1117" stroke="#ec4899" strokeWidth="1" strokeOpacity="0.7"/>
      <polygon points="92,55 98,42 86,38 86,55" fill="#0d1117" stroke="#ec4899" strokeWidth="1" strokeOpacity="0.7"/>
      <polygon points="50,25 54,36 65,33 58,43 68,48 57,52 60,64 50,58 40,64 43,52 32,48 42,43 35,33 46,36" fill="none" stroke="#fbcfe8" strokeWidth="1.8" filter="url(#svf)"/>
      <polygon points="50,32 53,39 60,37 55,43 59,49 52,47 50,54 48,47 41,49 45,43 40,37 47,39" fill="#f472b6" fillOpacity="0.7"/>
    </g>
  )
}

function SageBadge() {
  return (
    <g>
      <defs>
        <filter id="sgf"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="sgg" x1="15%" y1="5%" x2="85%" y2="95%"><stop offset="0%" stopColor="#fed7aa"/><stop offset="100%" stopColor="#c2410c"/></linearGradient>
      </defs>
      <polygon points="50,4 57,38 92,26 64,50 92,74 57,62 50,96 43,62 8,74 36,50 8,26 43,38" fill="#0d1117" stroke="#f97316" strokeWidth="1.5" filter="url(#sgf)"/>
      <polygon points="50,16 55,40 76,33 60,50 76,67 55,60 50,84 45,60 24,67 40,50 24,33 45,40" fill="url(#sgg)" fillOpacity="0.1"/>
      <circle cx="50" cy="50" r="18" fill="none" stroke="#fb923c" strokeWidth="1.2" strokeOpacity="0.5"/>
      <polygon points="50,36 60,50 50,64 40,50" fill="none" stroke="#fed7aa" strokeWidth="2" filter="url(#sgf)"/>
      <polygon points="50,41 55,50 50,59 45,50" fill="#fb923c" fillOpacity="0.9"/>
    </g>
  )
}

function MasterBadge() {
  return (
    <g>
      <defs>
        <filter id="mf"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="mg" x1="15%" y1="0%" x2="85%" y2="100%"><stop offset="0%" stopColor="#fde68a"/><stop offset="50%" stopColor="#f59e0b"/><stop offset="100%" stopColor="#78350f"/></linearGradient>
      </defs>
      <polygon points="18,42 18,14 30,28 38,10 50,26 62,10 70,28 82,14 82,42 88,55 50,92 12,55" fill="#0d1117" stroke="#d97706" strokeWidth="1.5" filter="url(#mf)"/>
      <polygon points="24,42 24,22 32,33 40,18 50,30 60,18 68,33 76,22 76,42 80,52 50,82 20,52" fill="url(#mg)" fillOpacity="0.1"/>
      <line x1="18" y1="42" x2="82" y2="42" stroke="#fbbf24" strokeWidth="1.2" strokeOpacity="0.5"/>
      <polygon points="38,10 41,18 35,18" fill="#fde68a" fillOpacity="0.8"/>
      <polygon points="50,6 53,16 47,16" fill="#fef3c7" fillOpacity="0.9"/>
      <polygon points="62,10 65,18 59,18" fill="#fde68a" fillOpacity="0.8"/>
      <polygon points="50,48 56,60 50,70 44,60" fill="none" stroke="#fde68a" strokeWidth="2" filter="url(#mf)"/>
      <polygon points="50,52 54,59 50,65 46,59" fill="#f59e0b" fillOpacity="0.9"/>
    </g>
  )
}

function LuminaryBadge() {
  return (
    <g>
      <defs>
        <filter id="lf"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="lfs"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <radialGradient id="lg" cx="50%" cy="35%" r="55%"><stop offset="0%" stopColor="#ffffff"/><stop offset="30%" stopColor="#fef08a"/><stop offset="100%" stopColor="#78350f"/></radialGradient>
      </defs>
      <polygon points="50,2 52,20 60,6 56,22 68,12 58,25 74,18 60,28 78,26 62,32 80,36 62,38 80,46 61,44 76,56 58,50 70,64 54,54 62,72 50,58 58,76 50,64 38,76 42,64 30,72 38,54 22,64 34,50 16,56 28,44 10,46 28,38 10,36 28,32 22,26 38,28 26,18 40,25 32,12 42,22 44,6 48,20" fill="url(#lg)" filter="url(#lf)" fillOpacity="0.9"/>
      <polygon points="50,8 88,50 50,92 12,50" fill="#0d1117" stroke="#fef08a" strokeWidth="1.5" filter="url(#lfs)"/>
      <polygon points="50,18 80,50 50,82 20,50" fill="url(#lg)" fillOpacity="0.08"/>
      <polygon points="50,28 72,50 50,72 28,50" fill="none" stroke="#fef08a" strokeWidth="0.8" strokeOpacity="0.4"/>
      <line x1="12" y1="50" x2="88" y2="50" stroke="#fef08a" strokeWidth="0.8" strokeOpacity="0.3"/>
      <line x1="50" y1="8" x2="50" y2="92" stroke="#fef08a" strokeWidth="0.8" strokeOpacity="0.3"/>
      <polygon points="50,36 53,45 62,45 55,51 58,60 50,55 42,60 45,51 38,45 47,45" fill="none" stroke="#ffffff" strokeWidth="1.5" filter="url(#lfs)"/>
      <polygon points="50,39 52,46 59,46 53,50 55,57 50,53 45,57 47,50 41,46 48,46" fill="#fef9c3" fillOpacity="0.95"/>
    </g>
  )
}

const BADGE_COMPONENTS = [
  WandererBadge, SeekerBadge, InitiateBadge, ApprenticeBadge, ScholarBadge,
  AdeptBadge,    SavantBadge, SageBadge,     MasterBadge,     LuminaryBadge,
]

export default function RankBadge({ tierIndex, size = 40, subLevel = 1, showPips = true }: RankBadgeProps) {
  const clamped      = Math.max(0, Math.min(9, tierIndex))
  const BadgeContent = BADGE_COMPONENTS[clamped]

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: 'visible' }}>
        <BadgeContent />
      </svg>
      {showPips && (
        <div style={{ display: 'flex', gap: 3 }}>
          {[1, 2, 3].map(pip => (
            <div
              key={pip}
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: pip <= subLevel ? 'var(--text)' : 'var(--surface-3)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/RankBadge.tsx
git commit -m "feat(ui): add RankBadge component with SVG designs for all 10 tiers"
```

---

## Task 10: MasteryBadge Component

**Files:**
- Create: `src/components/MasteryBadge.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/MasteryBadge.tsx`:
```tsx
/**
 * MasteryBadge — diamond-shaped flame badge for the 5 Flame mastery tiers.
 * Props:
 *   masteryIndex  0–4 (Ember / Kindled / Burning / Blazing / Inferno)
 *   size          pixel size (default 20)
 */

interface MasteryBadgeProps {
  masteryIndex: number
  size?:        number
}

export const MASTERY_NAMES = ['Ember', 'Kindled', 'Burning', 'Blazing', 'Inferno'] as const

// SVG flame path reused across tiers (viewBox 0 0 60 60, diamond outer shape)
function FlameShape({ fillColor, strokeColor, glowId, innerColor }: {
  fillColor:   string
  strokeColor: string
  glowId?:     string
  innerColor?: string
}) {
  return (
    <>
      <polygon
        points="30,4 56,30 30,56 4,30"
        fill="#0d1117"
        stroke={strokeColor}
        strokeWidth="1.5"
        filter={glowId ? `url(#${glowId})` : undefined}
      />
      <path
        d={`M 30,18 Q ${30+6},${24} ${30+4},${31} Q ${30+8},${26} ${30+5},${34} Q ${30+2},${40} 30,42
            Q ${30-2},${40} ${30-5},${34} Q ${30-8},${26} ${30-4},${31} Q ${30-6},${24} 30,18 Z`}
        fill={fillColor}
        fillOpacity="0.9"
      />
      {innerColor && (
        <path
          d={`M 30,23 Q ${30+3},${27} ${30+2},${31} Q ${30+3},${29} ${30+2},${33}
              Q ${30+1},${37} 30,38 Q ${30-1},${37} ${30-2},${33} Q ${30-3},${29} ${30-2},${31}
              Q ${30-3},${27} 30,23 Z`}
          fill={innerColor}
          fillOpacity="0.8"
        />
      )}
    </>
  )
}

const BADGE_CONFIGS = [
  // Ember — grey, minimal
  { strokeColor: '#57534e', fillColor: '#78716c', glowId: undefined, innerColor: undefined },
  // Kindled — orange
  { strokeColor: '#c2410c', fillColor: '#fdba74', glowId: 'kf',      innerColor: undefined },
  // Burning — gold with white inner
  { strokeColor: '#f59e0b', fillColor: '#fde68a', glowId: 'bf',      innerColor: '#ffffff' },
  // Blazing — bright gold, heptagon
  { strokeColor: '#d97706', fillColor: 'url(#blg)', glowId: 'blf',   innerColor: '#ffffff' },
  // Inferno — radiant, 12-pt burst
  { strokeColor: '#f59e0b', fillColor: 'url(#inf)', glowId: 'inf-f', innerColor: '#ffffff' },
]

export default function MasteryBadge({ masteryIndex, size = 20 }: MasteryBadgeProps) {
  const idx    = Math.max(0, Math.min(4, masteryIndex))
  const config = BADGE_CONFIGS[idx]

  return (
    <svg viewBox="0 0 60 60" width={size} height={size} style={{ overflow: 'visible', flexShrink: 0 }}>
      <defs>
        <filter id="kf"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="bf"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="blf"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="inf-f"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="blg" x1="20%" y1="5%" x2="80%" y2="95%"><stop offset="0%" stopColor="#ffffff"/><stop offset="40%" stopColor="#fde68a"/><stop offset="100%" stopColor="#b45309"/></linearGradient>
        <radialGradient id="inf" cx="50%" cy="30%" r="55%"><stop offset="0%" stopColor="#ffffff"/><stop offset="35%" stopColor="#fef08a"/><stop offset="100%" stopColor="#92400e"/></radialGradient>
      </defs>
      {idx === 4 ? (
        // Inferno: 12-pointed burst outer shape
        <>
          <polygon
            points="30,2 32,12 38,6 36,16 44,12 40,21 50,20 44,27 54,30 44,33 50,40 40,39 44,48 36,44 38,54 32,48 30,58 28,48 22,54 24,44 16,48 20,39 10,40 16,33 6,30 16,27 10,20 20,21 16,12 24,16 22,6 28,12"
            fill="url(#inf)"
            filter="url(#inf-f)"
          />
          <polygon points="30,10 50,30 30,50 10,30" fill="#0d1117" stroke="#fef08a" strokeWidth="1.2" filter="url(#inf-f)"/>
          <path d="M 30,18 Q 36,24 34,31 Q 39,26 36,33 Q 33,40 30,43 Q 27,40 24,33 Q 21,26 26,31 Q 24,24 30,18 Z" fill="url(#inf)"/>
          <path d="M 30,23 Q 33,27 32,31 Q 34,29 33,33 Q 31,37 30,38 Q 29,37 27,33 Q 26,29 28,31 Q 27,27 30,23 Z" fill="#ffffff" fillOpacity="0.95"/>
        </>
      ) : idx === 3 ? (
        // Blazing: heptagon
        <>
          <polygon points="30,4 50,14 57,35 47,54 13,54 3,35 10,14" fill="#0d1117" stroke="#d97706" strokeWidth="1.5" filter="url(#blf)"/>
          <path d="M 30,14 Q 37,21 35,29 Q 41,24 37,33 Q 33,40 30,44 Q 27,40 23,33 Q 19,24 25,29 Q 23,21 30,14 Z" fill="url(#blg)" filter="url(#blf)"/>
          <path d="M 30,22 Q 33,26 32,30 Q 35,28 33,33 Q 31,37 30,38 Q 29,37 27,33 Q 25,28 28,30 Q 27,26 30,22 Z" fill="#ffffff" fillOpacity="0.8"/>
        </>
      ) : (
        <FlameShape {...config} />
      )}
    </svg>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/MasteryBadge.tsx
git commit -m "feat(ui): add MasteryBadge component with 5 flame tier designs"
```

---

## Task 11: RankUpToast Component

**Files:**
- Create: `src/components/RankUpToast.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/RankUpToast.tsx`:
```tsx
import { useEffect, useState } from 'react'
import RankBadge from './RankBadge'
import type { RankInfo } from '../utils/progression'
import { playChime } from '../lib/chime'

interface RankUpEvent {
  previous: RankInfo
  current:  RankInfo
  key:      number   // Date.now() — forces re-trigger on same rank (shouldn't happen but safe)
}

interface RankUpToastProps {
  event: RankUpEvent | null
}

export default function RankUpToast({ event }: RankUpToastProps) {
  const [visible, setVisible] = useState(false)
  const [current, setCurrent] = useState<RankUpEvent | null>(null)

  useEffect(() => {
    if (!event) return
    setCurrent(event)
    setVisible(true)

    // Play chime on full tier rank-up only
    if (event.current.tierIndex > event.previous.tierIndex) {
      playChime('work')
    }

    const t = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(t)
  }, [event?.key])

  if (!current) return null

  const isTierUp    = current.current.tierIndex > current.previous.tierIndex
  const toastHeight = isTierUp ? 64 : 48

  return (
    <div
      style={{
        position:   'fixed',
        bottom:     24,
        right:      24,
        zIndex:     9999,
        display:    'flex',
        alignItems: 'center',
        gap:        12,
        background: 'var(--surface-2)',
        border:     `1px solid ${current.current.color}44`,
        borderRadius: 10,
        padding:    isTierUp ? '12px 16px' : '8px 14px',
        height:     toastHeight,
        boxShadow:  `0 4px 24px ${current.current.color}22`,
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 300ms ease, transform 300ms ease',
        pointerEvents: 'none',
      }}
    >
      <div style={{
        transform:  visible ? 'scale(1)' : 'scale(0.8)',
        transition: 'transform 400ms cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <RankBadge
          tierIndex={current.current.tierIndex}
          size={isTierUp ? 40 : 28}
          subLevel={current.current.subLevel}
          showPips={true}
        />
      </div>
      <div>
        <div style={{ fontSize: isTierUp ? 13 : 11, color: 'var(--text-mute)', marginBottom: 2 }}>
          {isTierUp ? 'New rank unlocked' : 'Rank up'}
        </div>
        <div style={{
          fontSize:   isTierUp ? 15 : 13,
          fontWeight: 600,
          color:      current.current.color,
        }}>
          {current.current.label}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/RankUpToast.tsx
git commit -m "feat(ui): add RankUpToast for sub-level and tier rank-up moments"
```

---

## Task 12: Wire Toast into PomodoroTimer and App

**Files:**
- Modify: `src/components/PomodoroTimer.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add rank-up event state to PomodoroTimer**

In `src/components/PomodoroTimer.tsx`, find the import section and add:
```typescript
import RankUpToast from './RankUpToast'
import type { RankInfo } from '../utils/progression'

interface RankUpEvent {
  previous: RankInfo
  current:  RankInfo
  key:      number
}
```

- [ ] **Step 2: Add rankUpEvent state to PomodoroTimer component**

Inside the `PomodoroTimer` function, find where `toast` state is declared and add alongside it:
```typescript
const [rankUpEvent, setRankUpEvent] = useState<RankUpEvent | null>(null)
```

- [ ] **Step 3: Update handleTick to use rank-up info**

Find the `handleTick` callback. Replace the `result.leveledUp` block:
```typescript
// Replace this:
const msg = result.leveledUp
  ? `🎉 Level up! You're now Level ${result.newLevel}`
  : `+${result.xp} XP`
setToast({ msg, key: Date.now() })
setTimeout(() => setToast(null), 3000)

// With this:
const msg = `+${result.xp} XP`
setToast({ msg, key: Date.now() })
setTimeout(() => setToast(null), 3000)

if (result.rankUp) {
  setRankUpEvent({ ...result.rankUp, key: Date.now() })
}
```

- [ ] **Step 4: Render RankUpToast in PomodoroTimer JSX**

Find where the existing `toast` is rendered in PomodoroTimer's return. Just before or after it, add:
```tsx
<RankUpToast event={rankUpEvent} />
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/PomodoroTimer.tsx
git commit -m "feat(timer): wire rank-up toast on session completion"
```

---

## Task 13: Sidebar — Rank Widget + Subject Mastery

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Add imports to Sidebar.tsx**

At the top of `src/components/Sidebar.tsx`, add:
```typescript
import useXPStore from '../store/useXPStore'
import useSubjectMasteryStore from '../store/useSubjectMasteryStore'
import RankBadge from './RankBadge'
import MasteryBadge from './MasteryBadge'
import { getRankFromXP, getRankProgress, getXPToNextRank, getMasteryFromXP } from '../utils/progression'
```

- [ ] **Step 2: Add rank/mastery selectors in the Sidebar component body**

Inside the `Sidebar` function, after the existing store selectors, add:
```typescript
const totalXP    = useXPStore(s => s.totalXP)
const subjectXP  = useSubjectMasteryStore(s => s.subjectXP)
const rank       = getRankFromXP(totalXP)
const rankPct    = Math.round(getRankProgress(totalXP) * 100)
const xpToNext   = getXPToNextRank(totalXP)
```

- [ ] **Step 3: Add the rank widget above the nav-user row**

In the JSX, find `{/* ── User row ── */}` and insert the following immediately before it (inside the `!collapsed` guard or unconditionally — wrap in `{!collapsed && ...}` so it hides when sidebar is collapsed):

```tsx
{/* ── Rank widget ── */}
{!collapsed && (
  <div style={{
    padding: '8px 10px 10px',
    borderTop: '1px solid var(--hairline)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <RankBadge tierIndex={rank.tierIndex} size={32} subLevel={rank.subLevel} showPips={false} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: rank.color, lineHeight: 1.2 }}>
          {rank.label}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1 }}>
          {xpToNext > 0 ? `${xpToNext.toLocaleString()} XP to next rank` : 'Max rank'}
        </div>
      </div>
    </div>
    {/* Progress bar */}
    <div style={{ marginTop: 6, height: 2, background: 'var(--surface-3)', borderRadius: 1 }}>
      <div style={{
        height: '100%',
        width: `${rankPct}%`,
        background: rank.color,
        borderRadius: 1,
        transition: 'width 600ms ease',
      }} />
    </div>
  </div>
)}
```

- [ ] **Step 4: Add mastery badge to subject rows**

Find the `subjects.map(s => ...)` block and replace it with:
```tsx
{subjects.map(s => {
  const sXP     = subjectXP[s.id] ?? 0
  const mastery = sXP > 0 ? getMasteryFromXP(sXP) : null
  return (
    <button key={s.id} className="nav-item" title={s.name}>
      <span className="subj-dot" style={{ background: s.color }} />
      <span className="nav-label">{s.name}</span>
      {!collapsed && mastery && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
          <MasteryBadge masteryIndex={mastery.index} size={14} />
          <span style={{ fontSize: 9, color: mastery.color, fontWeight: 600, letterSpacing: '0.5px' }}>
            {mastery.name.toUpperCase()}
          </span>
        </span>
      )}
    </button>
  )
})}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(sidebar): add rank widget and subject mastery badges"
```

---

## Task 14: Update RightRail LevelCard → RankCard

**Files:**
- Modify: `src/components/RightRail.tsx`

- [ ] **Step 1: Add progression imports to RightRail.tsx**

At the top of `src/components/RightRail.tsx`, add:
```typescript
import RankBadge from './RankBadge'
import { getRankFromXP, getRankProgress, getXPToNextRank } from '../utils/progression'
```

- [ ] **Step 2: Replace the LevelCard function**

Find `function LevelCard()` and replace the entire function with:
```tsx
function RankCard() {
  const totalXP = useXPStore(s => s.totalXP)
  const rank    = getRankFromXP(totalXP)
  const pct     = Math.round(getRankProgress(totalXP) * 100)
  const toNext  = getXPToNextRank(totalXP)

  return (
    <div className="v2-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <RankBadge tierIndex={rank.tierIndex} size={36} subLevel={rank.subLevel} showPips={true} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: rank.color }}>
            {rank.label}
          </div>
          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
            <b style={{ color: 'var(--text)', fontWeight: 500 }}>{totalXP.toLocaleString()}</b> XP total
          </div>
        </div>
      </div>

      <div className="xp-track">
        <div className="xp-fill" style={{ width: `${pct}%`, background: rank.color }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--text-faint)', marginTop: 4 }}>
        <span>{toNext > 0 ? `${toNext.toLocaleString()} XP to next rank` : 'Max rank reached'}</span>
        <span style={{ color: 'var(--xp)' }}>{rank.tierName}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Replace `<LevelCard />` call with `<RankCard />`**

Search the RightRail JSX for `<LevelCard />` and replace with `<RankCard />`.

- [ ] **Step 4: Remove the old LEVEL_NAMES constant and levelName function**

Delete these two lines (no longer needed):
```typescript
const LEVEL_NAMES = ['Novice', 'Beginner', 'Student', 'Scholar', 'Expert', 'Master', 'Sage', 'Legend']
function levelName(lv: number): string { return LEVEL_NAMES[Math.min(lv, LEVEL_NAMES.length - 1)] }
```

Also remove the `xpToLevel, xpProgress, xpToNextLevel, levelToXp` imports from `'../utils/xp'` if they are no longer used after the replacement. (Check first — `xpProgress` etc. may still be used elsewhere in the file.)

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/RightRail.tsx
git commit -m "feat(ui): replace LevelCard with RankCard using new rank system"
```

---

## Task 15: Stats Page — Progression Card

**Files:**
- Modify: `src/pages/StatsPage.tsx`

- [ ] **Step 1: Add imports to StatsPage.tsx**

At the top of `src/pages/StatsPage.tsx`, add:
```typescript
import useSubjectMasteryStore from '../store/useSubjectMasteryStore'
import RankBadge    from '../components/RankBadge'
import MasteryBadge from '../components/MasteryBadge'
import { getRankFromXP, getRankProgress, getXPToNextRank, getMasteryFromXP } from '../utils/progression'
```

- [ ] **Step 2: Add a ProgressionCard component inside StatsPage.tsx**

Add this new function component inside `StatsPage.tsx`, near the other card components:
```tsx
function ProgressionCard() {
  const totalXP   = useXPStore(s => s.totalXP)
  const sessions  = useXPStore(s => s.sessions)
  const subjects  = useSubjectStore(s => s.subjects)
  const subjectXP = useSubjectMasteryStore(s => s.subjectXP)

  const rank     = getRankFromXP(totalXP)
  const pct      = Math.round(getRankProgress(totalXP) * 100)
  const toNext   = getXPToNextRank(totalXP)

  // Total qualifying study hours (work sessions with durationSecs)
  const totalHours = sessions
    .filter(s => s.type === 'work' && s.durationSecs != null)
    .reduce((sum, s) => sum + (s.durationSecs ?? 0) / 3600, 0)

  const subjectsWithMastery = subjects
    .map(s => ({ subject: s, mastery: getMasteryFromXP(subjectXP[s.id] ?? 0) }))
    .filter(({ mastery }) => (subjectXP[mastery.subjectXP] ?? 0) > 0 || subjects.length > 0)

  return (
    <div className="v2-card">
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 14 }}>
        Progression
      </div>

      {/* Global rank */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <RankBadge tierIndex={rank.tierIndex} size={64} subLevel={rank.subLevel} showPips={true} />
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: rank.color }}>{rank.label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
            {totalXP.toLocaleString()} XP · {totalHours.toFixed(1)}h studied
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
            {toNext > 0 ? `${toNext.toLocaleString()} XP to next rank` : 'Max rank reached'}
          </div>
        </div>
      </div>

      {/* Rank progress bar */}
      <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 2, marginBottom: 20 }}>
        <div style={{
          height: '100%',
          width:  `${pct}%`,
          background: rank.color,
          borderRadius: 2,
          transition: 'width 600ms ease',
        }} />
      </div>

      {/* Subject mastery table */}
      {subjectsWithMastery.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 8 }}>
            Subject Mastery
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {subjectsWithMastery.map(({ subject, mastery }) => (
              <div key={subject.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="subj-dot" style={{ background: subject.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text)' }}>{subject.name}</span>
                <MasteryBadge masteryIndex={mastery.index} size={16} />
                <span style={{ fontSize: 11, color: mastery.color, fontWeight: 600, minWidth: 52, textAlign: 'right' }}>
                  {mastery.name}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Mount ProgressionCard in the StatsPage layout**

In the `StatsPage` return JSX, find a good place to insert the card (e.g. after the first row of stat cards or as a new section). Add:
```tsx
<ProgressionCard />
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/StatsPage.tsx
git commit -m "feat(stats): add Progression card with rank badge and subject mastery table"
```

---

## Task 16: Final Build Verification

- [ ] **Step 1: Run full build**

```bash
npm run build
```
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 2: Run tests**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 3: Manual smoke test**
- Open the app in dev mode: `npm run dev`
- Complete a timer session (work mode, ≥ 25 min, with a subject selected)
- Verify: XP increases by the correct amount (check console or XP display)
- Verify: Rank widget in sidebar shows correct rank and progress bar
- Verify: Subject in sidebar shows a mastery badge
- Verify: Stats page Progression card shows rank badge and subject mastery
- Complete enough sessions to trigger a rank-up, verify toast appears

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: progression system — dual-axis rank/mastery with new XP formula"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ XP formula: `calcSessionXP` + `getStreakMultiplier` in Task 2
- ✅ Break sessions keep flat XP: handled in Task 7 (`XP_REWARDS[sessionType]`)
- ✅ Historical migration: Task 8 SQL
- ✅ Global rank 30 tiers: `RANK_TIERS` in Task 3
- ✅ Rank badge designs: Task 9 (10 SVG badges)
- ✅ Sub-level pip dots: `showPips` prop in `RankBadge`
- ✅ Subject mastery 5 tiers: `MASTERY_TIERS` in Task 3
- ✅ Flame badge designs: Task 10 (5 SVG badges)
- ✅ XP flows into both global + subject pools: Task 7 `awardXP`
- ✅ Rank-up toast (sub-level and tier): Tasks 11–12
- ✅ Tier rank-up plays chime: Task 11 `playChime('work')` on tierIndex change
- ✅ Sidebar rank widget + progress bar: Task 13
- ✅ Subject mastery badges in sidebar: Task 13
- ✅ Stats Progression card: Task 15
- ✅ `subject_xp` Supabase table + RLS: Task 4
- ✅ Supabase helpers: Task 5
- ✅ subject_xp store with Supabase sync: Task 6
- ✅ XPBar / RightRail LevelCard updated: Task 14
