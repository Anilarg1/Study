# Architecture Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract stat derivation into testable utilities, sync settings and goals to Supabase, add realtime session merging, fix iOS Safari viewport clipping, tighten code quality, and add Playwright smoke tests + security headers.

**Architecture:** Pure utility functions in `src/utils/stats.ts` replace inline computation; two new Supabase tables (`user_prefs`, `goals`) back the settings and goals stores; a Supabase realtime channel merges sessions across devices; platform and code quality fixes are surgical one-file changes.

**Tech Stack:** React 18, Zustand 5, Supabase JS v2, Vitest 4, Playwright 1.60, TypeScript 6, Vite 6

---

## Pre-flight

Before starting, verify the test suite is green:

```bash
npm test
```

Expected: all tests pass. Fix any failures before proceeding.

---

## Task 1: Extract Pure Stat Functions into `src/utils/stats.ts`

**Files:**
- Modify: `src/utils/stats.ts`
- Modify: `src/components/GoalsPanel.tsx` (remove duplicate `sessionMins`)
- Modify: `src/tests/stats.test.ts`

### Why

`StatsPage.tsx` has ~300 lines of inline `useMemo` computation. These functions can't be unit-tested, can't be reused, and will be needed by the upcoming date-range picker and delta KPIs. Extracting them also removes the duplicate `sessionMins` defined locally in `GoalsPanel.tsx` (the canonical version is already in `src/utils/date.ts`).

- [ ] **Step 1: Add types and `calcMinsPerDay` to `src/utils/stats.ts`**

The file currently contains only `bestWeek`. Append these exports — do not remove `bestWeek`:

```ts
// src/utils/stats.ts  (append below bestWeek)

import { dateOf, sessionMins } from './date'
import type { SessionEntry } from '../types'

// ── shared types ──────────────────────────────────────────────────────────────

export interface DateRange {
  from: Date
  to:   Date
}

export interface KPIResult {
  totalMins:        number
  sessionCount:     number
  avgSessionMins:   number
  longestSessionMins: number
  prevTotalMins:    number
  prevSessionCount: number
}

export interface PeakHourResult {
  hour:      number   // 0–23, or -1 when no data
  label:     string   // '14:00 – 15:00' or '—'
  totalMins: number
}

export interface SubjectMinResult {
  subjectId: string
  mins:      number
}

export interface HistBar {
  label:   string
  count:   number
  height:  number   // 0–100 (percentage of tallest bar)
  isPeak:  boolean
}

// ── calcMinsPerDay ────────────────────────────────────────────────────────────

/**
 * Build a date-string → total-minutes map from an array of work sessions.
 * Used by the heatmap, records, and bestWeek.
 */
export function calcMinsPerDay(sessions: SessionEntry[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const s of sessions) {
    if (s.type !== 'work') continue
    const ds = dateOf(s.completedAt)
    map.set(ds, (map.get(ds) ?? 0) + sessionMins(s))
  }
  return map
}

// ── calcKPIs ──────────────────────────────────────────────────────────────────

/**
 * KPI totals for a set of current-period and previous-period work sessions.
 * Both arrays must already be filtered to work sessions only.
 */
export function calcKPIs(
  current: SessionEntry[],
  previous: SessionEntry[],
): KPIResult {
  const totalMins      = current.reduce((sum, s) => sum + sessionMins(s), 0)
  const sessionCount   = current.length
  const avgSessionMins = sessionCount > 0 ? Math.round(totalMins / sessionCount) : 0
  const longestSessionMins = current.reduce((mx, s) => Math.max(mx, sessionMins(s)), 0)
  const prevTotalMins  = previous.reduce((sum, s) => sum + sessionMins(s), 0)
  const prevSessionCount = previous.length
  return { totalMins, sessionCount, avgSessionMins, longestSessionMins, prevTotalMins, prevSessionCount }
}

// ── calcPeakHour ──────────────────────────────────────────────────────────────

/**
 * Find the clock hour (0–23) with the highest total study minutes.
 * Input: work sessions only.
 */
export function calcPeakHour(sessions: SessionEntry[]): PeakHourResult {
  const byHour = new Array<number>(24).fill(0)
  for (const s of sessions) {
    const h = new Date(s.completedAt).getHours()
    byHour[h] = (byHour[h] ?? 0) + sessionMins(s)
  }

  let peakMins = 0, peakHour = -1
  for (let h = 0; h < 24; h++) {
    if ((byHour[h] ?? 0) > peakMins) {
      peakMins = byHour[h] ?? 0
      peakHour = h
    }
  }

  if (peakHour === -1) return { hour: -1, label: '—', totalMins: 0 }
  const nextHour = (peakHour + 1) % 24
  return {
    hour:      peakHour,
    label:     `${peakHour}:00 – ${nextHour}:00`,
    totalMins: peakMins,
  }
}

// ── calcSubjectMins ───────────────────────────────────────────────────────────

/**
 * Minutes per subject, sorted descending. Input: work sessions only.
 */
export function calcSubjectMins(sessions: SessionEntry[]): SubjectMinResult[] {
  const map = new Map<string, number>()
  for (const s of sessions) {
    if (!s.subjectId) continue
    map.set(s.subjectId, (map.get(s.subjectId) ?? 0) + sessionMins(s))
  }
  return [...map.entries()]
    .map(([subjectId, mins]) => ({ subjectId, mins }))
    .sort((a, b) => b.mins - a.mins)
}

// ── calcSessionHistogram ──────────────────────────────────────────────────────

export interface HistBucket {
  label: string
  max:   number   // Infinity for the last bucket
}

/**
 * Count sessions per duration bucket and compute bar heights (0–100).
 * Input: work sessions only.
 */
export function calcSessionHistogram(
  sessions: SessionEntry[],
  buckets: readonly HistBucket[],
): HistBar[] {
  const counts = buckets.map((b, i) => {
    const prevMax = i > 0 ? (buckets[i - 1]?.max ?? 0) : 0
    return {
      label: b.label,
      count: sessions.filter(s => {
        const m = sessionMins(s)
        return m > prevMax && (b.max === Infinity ? true : m <= b.max)
      }).length,
    }
  })

  const maxCount = Math.max(1, ...counts.map(c => c.count))
  const peakIdx  = counts.reduce(
    (best, c, i) => c.count > (counts[best]?.count ?? 0) ? i : best,
    0,
  )

  return counts.map((c, i) => ({
    label:  c.label,
    count:  c.count,
    height: Math.max(2, (c.count / maxCount) * 100),
    isPeak: i === peakIdx,
  }))
}
```

- [ ] **Step 2: Add unit tests for the new functions in `src/tests/stats.test.ts`**

Append these `describe` blocks after the existing `bestWeek` tests:

```ts
// src/tests/stats.test.ts  (append)

import {
  calcMinsPerDay, calcKPIs, calcPeakHour,
  calcSubjectMins, calcSessionHistogram,
  type HistBucket,
} from '../utils/stats'
import type { SessionEntry } from '../types'

function makeSession(overrides: Partial<SessionEntry> = {}): SessionEntry {
  return {
    id:           'test-id',
    type:         'work',
    completedAt:  '2026-05-28T10:00:00.000Z',
    xp:           25,
    subjectId:    null,
    tagId:        null,
    durationSecs: 1500,   // 25 min
    ...overrides,
  }
}

describe('calcMinsPerDay', () => {
  it('returns empty map for empty input', () => {
    expect(calcMinsPerDay([])).toEqual(new Map())
  })

  it('ignores non-work sessions', () => {
    const s = makeSession({ type: 'shortBreak' })
    expect(calcMinsPerDay([s]).size).toBe(0)
  })

  it('accumulates minutes for the same date', () => {
    const s1 = makeSession({ durationSecs: 1500, completedAt: '2026-05-28T09:00:00.000Z' })
    const s2 = makeSession({ durationSecs: 1500, completedAt: '2026-05-28T11:00:00.000Z' })
    const map = calcMinsPerDay([s1, s2])
    // Key is local date; just check value sums to 50 (25+25)
    expect([...map.values()][0]).toBe(50)
  })
})

describe('calcKPIs', () => {
  it('returns zeros for empty inputs', () => {
    const r = calcKPIs([], [])
    expect(r.totalMins).toBe(0)
    expect(r.sessionCount).toBe(0)
    expect(r.avgSessionMins).toBe(0)
    expect(r.longestSessionMins).toBe(0)
    expect(r.prevTotalMins).toBe(0)
    expect(r.prevSessionCount).toBe(0)
  })

  it('computes totals and averages correctly', () => {
    const sessions = [
      makeSession({ durationSecs: 1500 }),  // 25 min
      makeSession({ durationSecs: 3000 }),  // 50 min
    ]
    const r = calcKPIs(sessions, [])
    expect(r.totalMins).toBe(75)
    expect(r.sessionCount).toBe(2)
    expect(r.avgSessionMins).toBe(38)
    expect(r.longestSessionMins).toBe(50)
    expect(r.prevTotalMins).toBe(0)
  })

  it('includes prev period counts', () => {
    const prev = [makeSession({ durationSecs: 900 })]  // 15 min
    const r = calcKPIs([], prev)
    expect(r.prevTotalMins).toBe(15)
    expect(r.prevSessionCount).toBe(1)
  })
})

describe('calcPeakHour', () => {
  it('returns hour -1 and label "—" for empty input', () => {
    const r = calcPeakHour([])
    expect(r.hour).toBe(-1)
    expect(r.label).toBe('—')
  })

  it('finds the hour with the most minutes', () => {
    const morning = makeSession({ completedAt: '2026-05-28T09:30:00.000Z', durationSecs: 1500 })
    const evening  = makeSession({ completedAt: '2026-05-28T19:00:00.000Z', durationSecs: 3600 })
    const r = calcPeakHour([morning, evening])
    expect(r.hour).toBe(19)
  })

  it('wraps label at hour 23 to 0:00 not 24:00', () => {
    const s = makeSession({ completedAt: '2026-05-28T23:00:00.000Z' })
    const r = calcPeakHour([s])
    expect(r.label).toBe('23:00 – 0:00')
  })
})

describe('calcSubjectMins', () => {
  it('returns empty array for no subjects', () => {
    expect(calcSubjectMins([])).toEqual([])
  })

  it('skips sessions without a subjectId', () => {
    expect(calcSubjectMins([makeSession({ subjectId: null })])).toEqual([])
  })

  it('aggregates and sorts descending', () => {
    const s1 = makeSession({ subjectId: 'a', durationSecs: 1500 })
    const s2 = makeSession({ subjectId: 'b', durationSecs: 3000 })
    const s3 = makeSession({ subjectId: 'a', durationSecs: 1500 })
    const r = calcSubjectMins([s1, s2, s3])
    expect(r[0]).toEqual({ subjectId: 'b', mins: 50 })
    expect(r[1]).toEqual({ subjectId: 'a', mins: 50 })
  })
})

describe('calcSessionHistogram', () => {
  const BUCKETS: readonly HistBucket[] = [
    { label: '0–25',   max: 25 },
    { label: '26–50',  max: 50 },
    { label: '51+',    max: Infinity },
  ]

  it('returns all-zero heights for empty sessions', () => {
    const r = calcSessionHistogram([], BUCKETS)
    expect(r.every(b => b.count === 0)).toBe(true)
  })

  it('places a 25-min session in the first bucket', () => {
    const r = calcSessionHistogram([makeSession({ durationSecs: 1500 })], BUCKETS)
    expect(r[0]?.count).toBe(1)
    expect(r[1]?.count).toBe(0)
  })

  it('marks the tallest bar as isPeak', () => {
    const sessions = [
      makeSession({ durationSecs: 1500 }),
      makeSession({ durationSecs: 1500 }),
      makeSession({ durationSecs: 3600 }),
    ]
    const r = calcSessionHistogram(sessions, BUCKETS)
    expect(r[0]?.isPeak).toBe(true)
    expect(r[1]?.isPeak).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests — verify all pass**

```bash
npm test
```

Expected output: all tests pass including the new `calcMinsPerDay`, `calcKPIs`, `calcPeakHour`, `calcSubjectMins`, `calcSessionHistogram` suites.

- [ ] **Step 4: Remove duplicate `sessionMins` from `GoalsPanel.tsx` and import from `utils/date`**

In `src/components/GoalsPanel.tsx`, remove lines 9–11:

```ts
// DELETE these lines:
function sessionMins(s: SessionEntry): number {
  return s.durationSecs ? Math.round(s.durationSecs / 60) : 25
}
```

Add the import at the top (line 4 area):

```ts
import { sessionMins } from '../utils/date'
```

Also remove the `import type { SessionEntry }` line if it's no longer needed after removing the local function (the store already types sessions).

- [ ] **Step 5: Update `StatsPage.tsx` to use `calcPeakHour` and `calcSubjectMins` from stats.ts**

At the top of `src/pages/StatsPage.tsx`, add to the stats import:

```ts
import { bestWeek, calcPeakHour, calcSubjectMins, calcKPIs, calcSessionHistogram, type HistBucket } from '../utils/stats'
```

Replace the `hourDaySummary` useMemo (lines ~390–409):

```ts
// REPLACE the entire hourDaySummary useMemo with:
const hourDaySummary = useMemo(() => {
  const { label } = calcPeakHour(workSessions)
  const dayTotals = Array.from({ length: 7 }, (_, i) => {
    const total = workSessions
      .filter(s => (new Date(s.completedAt).getDay() + 6) % 7 === i)
      .reduce((sum, s) => sum + sessionMins(s), 0)
    return { day: DAY_LABELS[i] ?? '', total }
  })
  const bestDay = [...dayTotals].sort((a, b) => b.total - a.total)[0] ?? null
  return {
    peakHour: label,
    bestDay:  bestDay !== null && bestDay.total > 0 ? bestDay.day : '—',
  }
}, [workSessions])
```

Replace the `subjectStats` useMemo (lines ~340–351):

```ts
// REPLACE the entire subjectStats useMemo with:
const subjectStats = useMemo(() => {
  return calcSubjectMins(workSessions).map(({ subjectId, mins }) => {
    const subj = subjects.find(s => s.id === subjectId)
    return { id: subjectId, name: subj?.name ?? 'Unknown', color: subj?.color ?? '#666', mins }
  })
}, [workSessions, subjects])
```

Replace the `histData` useMemo (lines ~412–426):

```ts
// REPLACE the entire histData useMemo with:
const histData = useMemo(
  () => calcSessionHistogram(workSessions, HIST_BUCKETS as readonly HistBucket[]),
  [workSessions],
)
```

- [ ] **Step 6: Run tests and build**

```bash
npm test && npm run build
```

Expected: all tests pass, build succeeds with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/utils/stats.ts src/tests/stats.test.ts src/components/GoalsPanel.tsx src/pages/StatsPage.tsx
git commit -m "refactor(stats): extract calcPeakHour, calcSubjectMins, calcKPIs, calcSessionHistogram into stats.ts"
```

---

## Task 2: Settings → Supabase Sync

**Files:**
- Create: Supabase migration (run via MCP or Supabase CLI)
- Modify: `src/lib/supabase.ts`
- Modify: `src/store/useSettingsStore.ts`
- Modify: `src/store/useAuthStore.ts`

### Why

Settings (theme, density, sound, etc.) are stored in `localStorage` only. Signing in on a new device resets everything to defaults.

- [ ] **Step 1: Apply the `user_prefs` migration in Supabase**

Run this SQL in the Supabase SQL editor or via MCP `apply_migration`:

```sql
create table if not exists user_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  prefs      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table user_prefs enable row level security;

create policy "user owns prefs"
  on user_prefs
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Verify in Supabase Table Editor that `user_prefs` now exists.

- [ ] **Step 2: Add Supabase helpers in `src/lib/supabase.ts`**

Append after the `fetchSubjectXP` function:

```ts
// ─── Settings helpers ─────────────────────────────────────────────────────────

/** Fetch the user's saved prefs blob. Returns null if no row yet. */
export async function fetchUserPrefs(
  userId: string,
): Promise<{ data: Record<string, unknown> | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('user_prefs')
    .select('prefs')
    .eq('user_id', userId)
    .maybeSingle()
  return { data: (data?.prefs as Record<string, unknown>) ?? null, error }
}

/** Upsert the user's prefs blob. Call fire-and-forget. */
export async function upsertUserPrefs(
  userId: string,
  prefs: Record<string, unknown>,
): Promise<PostgrestError | null> {
  const { error } = await supabase
    .from('user_prefs')
    .upsert({ user_id: userId, prefs, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  return error
}
```

- [ ] **Step 3: Add sync methods to `src/store/useSettingsStore.ts`**

Add these imports at the top of the file:

```ts
import { fetchUserPrefs, upsertUserPrefs } from '../lib/supabase'
import { getCurrentUserId } from '../lib/currentUser'
```

Add two new methods to the `SettingsState` interface (after the existing `toggle` line):

```ts
_importFromSupabase(prefs: Partial<SettingsData>): void
_syncToSupabase(): void
```

Add a module-level debounce timer reference just before the `create` call:

```ts
let _syncTimer: ReturnType<typeof setTimeout> | null = null
```

Add the implementations inside the `create` call, after the `toggle` method:

```ts
_importFromSupabase(prefs) {
  // Only sync non-device-local settings
  const { sidebarCollapsed: _skip, ...syncable } = prefs as SettingsData
  const allowed = Object.fromEntries(
    Object.entries(syncable).filter(([k]) => k !== 'sidebarCollapsed'),
  ) as Partial<SettingsData>
  set(allowed)
  // Re-apply DOM effects for synced values
  if (allowed.theme)       applyTheme(allowed.theme)
  if (allowed.density)     applyDensity(allowed.density)
  if (allowed.fontScale)   applyFontScale(allowed.fontScale)
  if (allowed.highContrast !== undefined) applyContrast(allowed.highContrast)
},

_syncToSupabase() {
  if (_syncTimer) clearTimeout(_syncTimer)
  _syncTimer = setTimeout(() => {
    const userId = getCurrentUserId()
    if (!userId) return
    const state = useSettingsStore.getState()
    const { setField: _a, toggle: _b, _importFromSupabase: _c, _syncToSupabase: _d, sidebarCollapsed: _e, ...prefs } = state
    upsertUserPrefs(userId, prefs as Record<string, unknown>).catch(console.error)
  }, 1000)
},
```

Update the `setField` and `toggle` actions to call `_syncToSupabase()` after each change:

```ts
setField: (key, value) => {
  set({ [key]: value } as Partial<SettingsState>)
  get()._syncToSupabase()
},
toggle: (key) => {
  set(s => ({ [key]: !s[key] } as Partial<SettingsState>))
  get()._syncToSupabase()
},
```

- [ ] **Step 4: Wire fetch in `src/store/useAuthStore.ts`**

Add the import at the top:

```ts
import useSettingsStore from './useSettingsStore'
import { fetchUserPrefs } from '../lib/supabase'
```

In `_syncFromSupabase`, add `fetchUserPrefs` to the `Promise.all` array:

```ts
const [xpResult, datesResult, subjectsResult, tagsResult, sessionsResult, subjectXPResult, prefsResult] = await Promise.all([
  fetchUserXP(userId),
  fetchLoginDates(userId),
  fetchSubjects(userId),
  fetchTags(userId),
  fetchSessions(userId, { limit: 2000 }),
  fetchSubjectXP(userId),
  fetchUserPrefs(userId),                // ← new
])
```

Add the import handler after the existing `subjectXPResult` block:

```ts
if (prefsResult.data) {
  useSettingsStore.getState()._importFromSupabase(
    prefsResult.data as Parameters<typeof useSettingsStore.getState()._importFromSupabase>[0]
  )
}
```

- [ ] **Step 5: Build to verify no TypeScript errors**

```bash
npm run build
```

Expected: zero errors. Fix any type mismatches before proceeding.

- [ ] **Step 6: Manual smoke test**

1. `npm run dev`, sign in
2. Change theme from Settings (e.g. light → dark)
3. Open Supabase Table Editor → `user_prefs` — confirm the row appears within ~2 seconds
4. Sign out and back in — theme should remain as set

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase.ts src/store/useSettingsStore.ts src/store/useAuthStore.ts
git commit -m "feat(settings): sync user prefs to Supabase user_prefs table"
```

---

## Task 3: Goals → Supabase

**Files:**
- Create: Supabase migration
- Create: `src/store/useGoalsStore.ts`
- Modify: `src/lib/supabase.ts`
- Modify: `src/components/GoalsPanel.tsx`
- Modify: `src/store/useAuthStore.ts`

### Why

Goal targets (monthly hours, streak, XP level) are hardcoded in `GoalsPanel.tsx`. This task moves targets to a `goals` table and introduces `useGoalsStore` so targets become user-configurable later.

- [ ] **Step 1: Apply the `goals` migration in Supabase**

```sql
create type goal_type as enum ('monthly_hours', 'streak', 'xp_rank', 'subject_hours');

create table if not exists goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  type         goal_type not null,
  target_value numeric not null,
  subject_id   uuid references subjects(id) on delete set null,
  due_date     date,
  created_at   timestamptz not null default now()
);

alter table goals enable row level security;

create policy "user owns goals"
  on goals
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Verify `goals` table exists in the Supabase Table Editor.

- [ ] **Step 2: Add Supabase helpers in `src/lib/supabase.ts`**

Append after the settings helpers added in Task 2:

```ts
// ─── Goals helpers ────────────────────────────────────────────────────────────

export interface GoalRow {
  id:          string
  type:        'monthly_hours' | 'streak' | 'xp_rank' | 'subject_hours'
  targetValue: number
  subjectId:   string | null
  dueDate:     string | null
}

export async function fetchGoals(
  userId: string,
): Promise<{ data: GoalRow[]; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('goals')
    .select('id, type, target_value, subject_id, due_date')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error || !data) return { data: [], error }
  return {
    data: data.map(r => ({
      id:          r.id           as string,
      type:        r.type         as GoalRow['type'],
      targetValue: r.target_value as number,
      subjectId:   r.subject_id   as string | null,
      dueDate:     r.due_date     as string | null,
    })),
    error: null,
  }
}

export async function upsertGoal(
  userId: string,
  goal: Omit<GoalRow, 'id'> & { id?: string },
): Promise<{ data: GoalRow | null; error: PostgrestError | null }> {
  const payload = {
    ...(goal.id ? { id: goal.id } : {}),
    user_id:      userId,
    type:         goal.type,
    target_value: goal.targetValue,
    subject_id:   goal.subjectId ?? null,
    due_date:     goal.dueDate   ?? null,
  }
  const { data, error } = await supabase
    .from('goals')
    .upsert(payload, { onConflict: 'id' })
    .select('id, type, target_value, subject_id, due_date')
    .single()
  if (error || !data) return { data: null, error }
  return {
    data: {
      id:          data.id           as string,
      type:        data.type         as GoalRow['type'],
      targetValue: data.target_value as number,
      subjectId:   data.subject_id   as string | null,
      dueDate:     data.due_date     as string | null,
    },
    error: null,
  }
}

/** Seed default goals for a new user if they have none. */
export async function seedDefaultGoals(userId: string): Promise<void> {
  const { data: existing } = await fetchGoals(userId)
  if (existing.length > 0) return
  await Promise.all([
    upsertGoal(userId, { type: 'monthly_hours', targetValue: 40, subjectId: null, dueDate: null }),
    upsertGoal(userId, { type: 'xp_rank',       targetValue: 1,  subjectId: null, dueDate: null }),
  ])
}
```

- [ ] **Step 3: Create `src/store/useGoalsStore.ts`**

```ts
import { create } from 'zustand'
import { fetchGoals, upsertGoal, seedDefaultGoals, type GoalRow } from '../lib/supabase'
import { getCurrentUserId } from '../lib/currentUser'

interface GoalsState {
  goals: GoalRow[]
  fetchGoals(userId: string): Promise<void>
  upsertGoal(goal: Omit<GoalRow, 'id'> & { id?: string }): Promise<void>
  _reset(): void
}

const useGoalsStore = create<GoalsState>()((set) => ({
  goals: [],

  async fetchGoals(userId) {
    await seedDefaultGoals(userId)
    const { data } = await fetchGoals(userId)
    set({ goals: data })
  },

  async upsertGoal(goal) {
    const userId = getCurrentUserId()
    if (!userId) return
    const { data } = await upsertGoal(userId, goal)
    if (!data) return
    set(state => ({
      goals: state.goals.some(g => g.id === data.id)
        ? state.goals.map(g => g.id === data.id ? data : g)
        : [...state.goals, data],
    }))
  },

  _reset() {
    set({ goals: [] })
  },
}))

export default useGoalsStore
```

- [ ] **Step 4: Wire goals fetch in `src/store/useAuthStore.ts`**

Add the import:

```ts
import useGoalsStore from './useGoalsStore'
```

Add to `_syncFromSupabase`, after the settings import handler added in Task 2 — call goals fetch (this one is async and order-independent from the Promise.all):

```ts
// after the prefsResult block:
useGoalsStore.getState().fetchGoals(userId).catch(console.error)
```

Add to `signOut`:

```ts
useGoalsStore.getState()._reset()
```

- [ ] **Step 5: Refactor `src/components/GoalsPanel.tsx` to read targets from store**

Replace the entire file with:

```tsx
import { useMemo } from 'react'
import useXPStore      from '../store/useXPStore'
import useStreakStore, { calcCurrentStreak } from '../store/useStreakStore'
import useGoalsStore   from '../store/useGoalsStore'
import { sessionMins } from '../utils/date'
import { xpProgress, levelToXp, xpToLevel } from '../utils/xp'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function GoalsPanel() {
  const sessions   = useXPStore(s => s.sessions)
  const totalXP    = useXPStore(s => s.totalXP)
  const loginDates = useStreakStore(s => s.loginDates)
  const goals      = useGoalsStore(s => s.goals)

  const loginDateSet  = useMemo(() => new Set(loginDates), [loginDates])
  const currentStreak = useMemo(() => calcCurrentStreak(loginDateSet), [loginDateSet])

  const level    = xpToLevel(totalXP)
  const xpProg   = xpProgress(totalXP)
  const xpToNext = levelToXp(level + 1) - totalXP

  const thisMonthMins = useMemo(() => {
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    return sessions
      .filter(s => s.type === 'work' && new Date(s.completedAt) >= start)
      .reduce((sum, s) => sum + sessionMins(s), 0)
  }, [sessions])

  const hourGoal      = goals.find(g => g.type === 'monthly_hours')?.targetValue ?? 40
  const monthGoalMins = hourGoal * 60
  const monthGoalPct  = Math.min(100, Math.round(thisMonthMins / monthGoalMins * 100))

  const streakGoal    = Math.ceil((currentStreak + 1) / 5) * 5
  const streakGoalPct = Math.min(100, Math.round(currentStreak / streakGoal * 100))
  const xpGoalPct     = Math.min(100, Math.round(xpProg * 100))

  const now = new Date()

  return (
    <div className="sidebar-goals">
      <div className="sidebar-goals-head">
        Goals
        <span className="sidebar-goals-month">{MONTH_NAMES[now.getMonth()]}</span>
      </div>

      <div className="sg-list">
        <div className="sg-row">
          <span className="sg-dot" style={{ background: 'var(--focus)' }} />
          <span className="sg-label">{hourGoal}h study</span>
          <div className="sg-bar">
            <div className="sg-fill" style={{ width: `${monthGoalPct}%`, background: 'var(--focus)' }} />
          </div>
          <span className="sg-val">
            {Math.floor(thisMonthMins / 60)}h {String(thisMonthMins % 60).padStart(2, '0')}m
          </span>
        </div>

        <div className="sg-row">
          <span className="sg-dot" style={{ background: 'var(--streak)' }} />
          <span className="sg-label">{streakGoal}d streak</span>
          <div className="sg-bar">
            <div className="sg-fill" style={{ width: `${streakGoalPct}%`, background: 'var(--streak)' }} />
          </div>
          <span className="sg-val">{currentStreak}/{streakGoal}</span>
        </div>

        <div className="sg-row">
          <span className="sg-dot" style={{ background: 'var(--xp)' }} />
          <span className="sg-label">Lv {level + 1}</span>
          <div className="sg-bar">
            <div className="sg-fill" style={{ width: `${xpGoalPct}%`, background: 'var(--xp)' }} />
          </div>
          <span className="sg-val">{xpToNext.toLocaleString()} XP</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Build and smoke test**

```bash
npm run build
```

Expected: no errors. Run dev, sign in, and verify GoalsPanel still renders with the same visual appearance. Check Supabase `goals` table — three rows should appear for a new user after first sign-in.

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase.ts src/store/useGoalsStore.ts src/store/useAuthStore.ts src/components/GoalsPanel.tsx
git commit -m "feat(goals): persist goal targets to Supabase goals table"
```

---

## Task 4: Realtime Session Sync

**Files:**
- Modify: `src/store/useXPStore.ts`
- Modify: `src/store/useAuthStore.ts`

### Why

Sessions inserted on another device aren't reflected until the page reloads. A Supabase realtime channel echoes `INSERT` events back so all tabs/devices stay current. The channel also deduplicates the local optimistic write.

- [ ] **Step 1: Add `_mergeSession` to `src/store/useXPStore.ts`**

Add `_mergeSession` to the `XPState` interface after `_reset`:

```ts
_mergeSession(session: SessionEntry): void
```

Add the implementation inside `create`, after `_reset`:

```ts
_mergeSession(session) {
  set(state => {
    // Skip if already present (deduplicates the optimistic local write)
    if (state.sessions.some(s => s.id === session.id)) return state
    const sessions = [...state.sessions, session]
      .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())
      .slice(-MAX_LOCAL_SESSIONS)
    return { sessions }
  })
},
```

- [ ] **Step 2: Add realtime subscription to `src/store/useAuthStore.ts`**

Add a module-level variable for the channel above the `_authSub` declaration:

```ts
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { TimerMode } from '../types'

let _sessionChannel: RealtimeChannel | null = null
```

Add a helper function before `create`:

```ts
function subscribeToSessions(userId: string): RealtimeChannel {
  return supabase
    .channel(`sessions:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sessions', filter: `user_id=eq.${userId}` },
      (payload) => {
        const r = payload.new as Record<string, unknown>
        useXPStore.getState()._mergeSession({
          id:           r['id']           as string,
          type:         r['type']         as TimerMode,
          completedAt:  r['completed_at'] as string,
          xp:           r['xp']           as number,
          subjectId:    r['subject_id']   as string | null,
          tagId:        r['tag_id']       as string | null,
          durationSecs: r['duration_secs'] as number | null,
        })
      },
    )
    .subscribe()
}
```

In `_syncFromSupabase`, after the last import handler, add:

```ts
// Subscribe to realtime session inserts (unsubscribes on sign-out)
_sessionChannel?.unsubscribe()
_sessionChannel = subscribeToSessions(userId)
```

In `signOut`, before `await supabase.auth.signOut()`:

```ts
_sessionChannel?.unsubscribe()
_sessionChannel = null
```

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Manual smoke test (two tabs)**

1. Open the app in two browser tabs, both signed in as the same user
2. Complete a session in tab 1
3. Switch to tab 2 — the RightRail session count and stats should update without a reload

- [ ] **Step 5: Commit**

```bash
git add src/store/useXPStore.ts src/store/useAuthStore.ts
git commit -m "feat(realtime): sync session inserts across tabs via Supabase channel"
```

---

## Task 5: Mobile Platform Correctness

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`
- Modify: `src/App.tsx`
- Modify: `src/components/ErrorBoundary.tsx`

### Why

`100vh` on iOS Safari includes the browser chrome height, causing the app shell to extend behind the URL bar. `dvh` (dynamic viewport height) responds to the visible area. The bottom tab bar also needs `safe-area-inset-bottom` padding for iPhone home indicator clearance.

- [ ] **Step 1: Add `viewport-fit=cover` to `index.html`**

Replace the existing viewport meta tag (line 6):

```html
<!-- BEFORE: -->
<meta name="viewport" content="width=device-width, initial-scale=1.0" />

<!-- AFTER: -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

`viewport-fit=cover` is required for `env(safe-area-inset-*)` to work on iOS.

- [ ] **Step 2: Replace `100vh` with `100dvh` in `src/index.css`**

There are two occurrences. Find them with:

```bash
grep -n "100vh" src/index.css
```

Line ~84 (app-shell):

```css
/* BEFORE: */
height: 100vh;

/* AFTER: */
height: 100dvh;
```

Line ~1670 (login-root):

```css
/* BEFORE: */
height: 100vh;

/* AFTER: */
height: 100dvh;
```

- [ ] **Step 3: Replace `100vh` in `src/App.tsx`**

The loading/error fallback div (line ~105) has `minHeight: '100vh'`. Change to `'100dvh'`:

```tsx
// BEFORE:
<div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

// AFTER:
<div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
```

- [ ] **Step 4: Replace `100vh` in `src/components/ErrorBoundary.tsx`**

Line ~21 has `minHeight: '100vh'`. Change to `'100dvh'`.

- [ ] **Step 5: Add safe-area-inset padding to BottomTabBar**

In `src/index.css`, find the `.bottom-tab-bar` rule inside the `@media (max-width: 900px)` block and add the bottom padding:

```css
/* Find the rule that looks like: */
.bottom-tab-bar {
  /* existing styles... */
}

/* Add this property: */
.bottom-tab-bar {
  padding-bottom: calc(8px + env(safe-area-inset-bottom));
}
```

If the rule already has `padding-bottom`, replace it with the `calc()` version.

- [ ] **Step 6: Build and verify**

```bash
npm run build
```

Expected: no errors. Open in Chrome DevTools → device mode → iPhone 14 Pro → verify no layout clips at top or bottom.

- [ ] **Step 7: Commit**

```bash
git add index.html src/index.css src/App.tsx src/components/ErrorBoundary.tsx
git commit -m "fix(mobile): replace 100vh with 100dvh; add safe-area-inset to tab bar"
```

---

## Task 6: Code Quality Fixes

**Files:**
- Modify: `src/components/CommandPalette.tsx`
- Modify: `src/components/Sidebar.tsx`

### Why

Small targeted fixes: the command palette filters on every keystroke without deferral; the Sidebar subject list selector triggers renders when the array reference changes even if content is identical.

- [ ] **Step 1: Wrap command palette filter in `useDeferredValue`**

In `src/components/CommandPalette.tsx`:

Add `useDeferredValue` to the React import:

```ts
import { useEffect, useRef, useState, useDeferredValue } from 'react'
```

After `const [query, setQuery] = useState('')`, add:

```ts
const deferredQuery = useDeferredValue(query)
```

Replace the filter that uses `q` with `deferredQuery`:

```ts
// BEFORE:
const q = query.trim().toLowerCase()
const allCmds  = [...actionCmds, ...subjectCmds]
const filtered = q
  ? allCmds.filter(c => c.label.toLowerCase().includes(q))
  : allCmds

// AFTER:
const dq = deferredQuery.trim().toLowerCase()
const allCmds  = [...actionCmds, ...subjectCmds]
const filtered = dq
  ? allCmds.filter(c => c.label.toLowerCase().includes(dq))
  : allCmds
```

- [ ] **Step 2: Add shallow equality to the subjects selector in `Sidebar.tsx`**

Add the import at the top of `src/components/Sidebar.tsx`:

```ts
import { useShallow } from 'zustand/react/shallow'
```

Find the subject selector (line ~46):

```ts
// BEFORE:
const subjects   = useSubjectStore(s => s.subjects)

// AFTER:
const subjects   = useSubjectStore(useShallow(s => s.subjects))
```

- [ ] **Step 3: Build and run tests**

```bash
npm test && npm run build
```

Expected: all tests pass, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/CommandPalette.tsx src/components/Sidebar.tsx
git commit -m "perf: defer command palette filter; shallow-equal sidebar subject selector"
```

---

## Task 7: Playwright Smoke Test

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/smoke.spec.ts`

### Why

No end-to-end test covers the critical path (sign-in → session → XP). A single smoke test will catch regressions that unit tests miss.

**Note:** Playwright tests require real credentials and a running dev server. They are not run in CI by default — run them manually before major pushes or when the auth/timer flow changes.

- [ ] **Step 1: Create `playwright.config.ts` at the project root**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    video:      'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url:     'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 20_000,
  },
})
```

- [ ] **Step 2: Create `tests/e2e/smoke.spec.ts`**

Replace `TEST_EMAIL` and `TEST_PASSWORD` with real credentials for your test user, or read from env vars.

```ts
import { test, expect } from '@playwright/test'

const EMAIL    = process.env['E2E_EMAIL']    ?? 'test@example.com'
const PASSWORD = process.env['E2E_PASSWORD'] ?? 'testpassword'

test.describe('Critical path smoke test', () => {
  test('sign in, complete a session, see XP awarded', async ({ page }) => {
    // ── 1. Load app → should show login ──────────────────────────────────────
    await page.goto('/')
    await expect(page.locator('input[type="email"]')).toBeVisible()

    // ── 2. Sign in ────────────────────────────────────────────────────────────
    await page.fill('input[type="email"]',    EMAIL)
    await page.fill('input[type="password"]', PASSWORD)
    await page.click('button[type="submit"]')

    // Wait for app shell to load (timer page)
    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 10_000 })

    // ── 3. Fast-forward timer via store manipulation ──────────────────────────
    // Set remaining to 1 second so the tick loop fires quickly
    await page.evaluate(() => {
      // Access the Zustand store from window (dev only — requires no tree-shaking of store ref)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const store = (window as any).__TIMER_STORE__
      if (store) store.getState().start()
    })

    // Alternative approach: use page.clock to fast-forward time
    await page.clock.install()
    await page.evaluate(() => {
      // Zustand timer store uses Date.now() and expiresAt
      // Set expiresAt to 1 second from now so next tick finishes the session
    })

    // ── 4. Start a session via the UI ─────────────────────────────────────────
    // Click start on the timer page
    await page.click('button[aria-label="Start"], button:has-text("Start")')

    // Use clock to advance past the timer
    await page.clock.fastForward(26 * 60 * 1000)  // 26 minutes

    // ── 5. Verify XP toast appears ────────────────────────────────────────────
    await expect(page.locator('[class*="toast"], [class*="xp"]').filter({ hasText: 'XP' }))
      .toBeVisible({ timeout: 5_000 })

    // ── 6. Navigate to stats and verify session count > 0 ────────────────────
    await page.click('a[href="/stats"], button:has-text("Stats")')
    await expect(page.locator('[class*="kpi"], [class*="stat"]').first()).toBeVisible()

    // ── 7. Sign out ───────────────────────────────────────────────────────────
    await page.click('button:has-text("Sign out"), [aria-label*="sign out" i]')
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5_000 })
  })
})
```

**Note on the clock approach:** Playwright's `page.clock.fastForward` works when the timer uses `Date.now()` — which `useTimerStore` does via `expiresAt`. If the timer doesn't fire automatically, an alternative is to click the Skip button after starting.

- [ ] **Step 3: Add E2E scripts to `package.json`**

```json
"scripts": {
  "dev":        "vite",
  "build":      "vite build",
  "preview":    "vite preview",
  "test":       "vitest run",
  "test:watch": "vitest",
  "e2e":        "playwright test",
  "e2e:ui":     "playwright test --ui",
  "analyze":    "npx vite-bundle-visualizer"
}
```

- [ ] **Step 4: Run the unit tests to confirm nothing broke**

```bash
npm test
```

Expected: all pass. (E2E tests are run separately with `npm run e2e` against a live server.)

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/smoke.spec.ts package.json
git commit -m "test(e2e): add Playwright smoke test + analyze script"
```

---

## Task 8: Security Headers

**Files:**
- Create: `vercel.json`

### Why

Without explicit headers, Vercel serves no `Content-Security-Policy`, `X-Frame-Options`, or `X-Content-Type-Options`. These are low-effort defences against clickjacking and MIME sniffing.

- [ ] **Step 1: Create `vercel.json` at the project root**

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com"
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Verify fonts still load**

```bash
npm run dev
```

Open the app in a browser, open DevTools → Console. There should be no CSP violations. Google Fonts load from `fonts.googleapis.com` / `fonts.gstatic.com` which are whitelisted above.

- [ ] **Step 3: Commit and push**

```bash
git add vercel.json
git commit -m "security: add CSP, X-Frame-Options, X-Content-Type-Options headers via vercel.json"
```

---

## Final Verification

- [ ] Run full test suite:

```bash
npm test
```

Expected: all tests pass.

- [ ] Run production build:

```bash
npm run build
```

Expected: builds cleanly, no TypeScript errors.

- [ ] Run bundle audit (one-off — no threshold, just inspect):

```bash
npm run analyze
```

Check that no unexpected large deps appear. Expected top chunks: `vendor-react`, `vendor-supabase`, `vendor-zustand` as defined in `vite.config.ts`.

- [ ] Final commit if any loose files remain:

```bash
git status
```

All changes should be committed. Push to main when verified:

```bash
git push
```

---

## File Summary

| File | Status | Change |
|---|---|---|
| `src/utils/stats.ts` | Modified | +`calcMinsPerDay`, `calcKPIs`, `calcPeakHour`, `calcSubjectMins`, `calcSessionHistogram`, shared types |
| `src/tests/stats.test.ts` | Modified | +tests for all new stat functions |
| `src/components/GoalsPanel.tsx` | Modified | Remove local `sessionMins`; read hour target from `useGoalsStore` |
| `src/pages/StatsPage.tsx` | Modified | Replace 3 inline `useMemo` computations with imported functions |
| `src/lib/supabase.ts` | Modified | +`fetchUserPrefs`, `upsertUserPrefs`, `fetchGoals`, `upsertGoal`, `seedDefaultGoals`, `GoalRow` |
| `src/store/useSettingsStore.ts` | Modified | +`_importFromSupabase`, `_syncToSupabase`; `setField`/`toggle` call sync |
| `src/store/useGoalsStore.ts` | Created | New Zustand store for goal targets |
| `src/store/useXPStore.ts` | Modified | +`_mergeSession` |
| `src/store/useAuthStore.ts` | Modified | +settings sync, goals fetch, realtime subscription/unsubscribe |
| `index.html` | Modified | `viewport-fit=cover` |
| `src/index.css` | Modified | `100vh` → `100dvh` (×2); `safe-area-inset-bottom` on tab bar |
| `src/App.tsx` | Modified | `100vh` → `100dvh` |
| `src/components/ErrorBoundary.tsx` | Modified | `100vh` → `100dvh` |
| `src/components/CommandPalette.tsx` | Modified | `useDeferredValue` on query |
| `src/components/Sidebar.tsx` | Modified | `useShallow` on subjects selector |
| `playwright.config.ts` | Created | Playwright config |
| `tests/e2e/smoke.spec.ts` | Created | Critical path E2E test |
| `package.json` | Modified | +`e2e`, `e2e:ui`, `analyze` scripts |
| `vercel.json` | Created | Security headers |
| Supabase | Migration | `user_prefs` and `goals` tables |
