# Architecture Hardening — Design Spec

**Date:** 2026-05-28  
**Scope:** Foundation improvements to stats, persistence, platform correctness, testing, and code quality. No new user-visible features except where noted.  
**Priority:** Do this before any new feature work.

---

## 1. Stats Module Extraction

### Problem
`StatsPage.tsx` contains all stat derivation logic inline — peak-hour computation, heatmap bucketing, KPI calculation, session histogram, subject breakdown. It recalculates on every render and cannot be tested in isolation.

### Design
Expand `src/utils/stats.ts` with pure functions that take `SessionEntry[]` and a date range, and return typed result objects. Components call these inside `useMemo`.

**Functions to add:**

```ts
// src/utils/stats.ts

export type DateRange = { from: Date; to: Date }

export interface KPIResult {
  totalMins: number
  sessionCount: number
  avgSessionMins: number
  longestSessionMins: number
  prevTotalMins: number       // same window, previous period — for delta %
  prevSessionCount: number
}

export interface HeatmapCell {
  date: string           // 'YYYY-MM-DD'
  mins: number
}

export interface PeakHourResult {
  hour: number           // 0–23
  totalMins: number
}

export interface SubjectMinutes {
  subjectId: string
  mins: number
}

export interface HistogramBucket {
  label: string          // e.g. '0–10 min'
  count: number
}

export function calcMinsPerDay(sessions: SessionEntry[]): Map<string, number>
export function calcKPIs(sessions: SessionEntry[], range: DateRange, allSessions: SessionEntry[]): KPIResult
export function calcPeakHour(sessions: SessionEntry[]): PeakHourResult
export function calcSubjectMins(sessions: SessionEntry[], range: DateRange): SubjectMinutes[]
export function calcSessionHistogram(sessions: SessionEntry[], buckets: readonly { label: string; max: number }[]): HistogramBucket[]
// bestWeek already exists — keep as-is
```

**Component pattern:**

```ts
// StatsPage.tsx
const kpis = useMemo(
  () => calcKPIs(sessions, range, allSessions),
  [sessions, range, allSessions]
)
```

All current inline derivation in `StatsPage.tsx` migrates to these functions. The component becomes data-passing only.

### What changes
- `src/utils/stats.ts` — add the six new functions above
- `src/pages/StatsPage.tsx` — replace inline derivation with `useMemo` + imported functions
- `src/components/stats/*.tsx` — any derivation that leaked into child components moves up to `StatsPage` and passes down via props

### What does NOT change
- No new DB queries; all functions work on the in-memory `sessions` array
- Chart rendering logic stays in components

---

## 2. XP Unit Tests

### Problem
`calcSessionXP` and `getStreakMultiplier` have boundary cases (exactly 25 min, streaks of exactly 3/7/30 days) that are easy to break silently.

### Design
New file `src/tests/xp.test.ts` using Vitest (already in the stack).

**Cases to cover:**

| Function | Input | Expected |
|---|---|---|
| `calcSessionXP` | 0s | 0 |
| `calcSessionXP` | 60s (1 min) | 1 |
| `calcSessionXP` | 1499s (24.98 min) | 24 |
| `calcSessionXP` | 1500s (25 min exactly) | `floor(25^1.5/5)` = 25 |
| `calcSessionXP` | 3600s (60 min) | `floor(60^1.5/5)` = 92 |
| `getStreakMultiplier` | 0 | 1.0 |
| `getStreakMultiplier` | 2 | 1.0 |
| `getStreakMultiplier` | 3 | 1.2 |
| `getStreakMultiplier` | 6 | 1.2 |
| `getStreakMultiplier` | 7 | 1.5 |
| `getStreakMultiplier` | 29 | 1.5 |
| `getStreakMultiplier` | 30 | 2.0 |
| `xpToLevel` / `levelToXp` | round-trip for levels 0–10 | exact inverse |
| `bestWeek` (stats.ts) | empty map | `{ bestWeekMins: 0, bestWeekStart: '' }` |
| `bestWeek` | single day | that day's value |

---

## 3. Settings → Supabase Sync

### Problem
`useSettingsStore` persists to `localStorage` only. Settings are lost when a user signs in on a new device. Every future setting added is a one-off hack without a DB-backed sync layer.

### Design

**Migration:** Add a `user_prefs` table in Supabase.

```sql
create table user_prefs (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  prefs        jsonb not null default '{}',
  updated_at   timestamptz not null default now()
);
alter table user_prefs enable row level security;
create policy "user owns prefs" on user_prefs
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

`prefs` is a jsonb column storing the full settings object. This avoids a migration every time a setting is added.

**Store changes:**

```ts
// useSettingsStore.ts — add two methods:
_importFromSupabase(prefs: Partial<SettingsData>): void
_syncToSupabase(): void   // debounced 1000ms, called from setField/toggle
```

**Sync flow:**
1. On sign-in (`useAuthStore`): fetch `user_prefs` row, call `_importFromSupabase`. Remote wins over local for all fields except `sidebarCollapsed` (local preference, not synced).
2. On any `setField`/`toggle` call: schedule debounced `upsert` to `user_prefs`. Debounce 1s to batch rapid changes (e.g. dragging a slider).
3. Unauthenticated: fall back silently to current localStorage behaviour.

**`sidebarCollapsed` stays local-only** — it's a per-device preference, not a user preference.

---

## 4. Goals → Supabase

### Problem
Goals in `GoalsPanel.tsx` use hardcoded targets (40 h/month, next 5-day streak milestone). No persistence, no editability.

### Design

**Migration:**

```sql
create type goal_type as enum ('monthly_hours', 'streak', 'xp_rank', 'subject_hours');

create table goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  type         goal_type not null,
  target_value numeric not null,
  subject_id   uuid references subjects(id) on delete cascade,
  due_date     date,
  created_at   timestamptz not null default now()
);
alter table goals enable row level security;
create policy "user owns goals" on goals
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

**New store:** `src/store/useGoalsStore.ts`

```ts
interface GoalEntry {
  id:          string
  type:        'monthly_hours' | 'streak' | 'xp_rank' | 'subject_hours'
  targetValue: number
  subjectId:   string | null
  dueDate:     string | null   // ISO date
}

interface GoalsState {
  goals: GoalEntry[]
  fetchGoals(userId: string): Promise<void>
  upsertGoal(goal: Omit<GoalEntry, 'id'> & { id?: string }): Promise<void>
}
```

**Default seeding:** On first sign-in, if `goals` table is empty for the user, insert the three current hardcoded defaults (monthly_hours=40, streak=next-5, xp_rank=next-level). This avoids a blank panel for new users.

**`GoalsPanel` changes:** Remove hardcoded targets. Read from `useGoalsStore`. Progress computation moves into the store as a selector (not computed inside the component on every render).

---

## 5. Optimistic UI + Realtime Subscription

### Problem
Sessions are fetched once on sign-in. Changes made on another device (or browser tab) are not reflected until the page reloads.

### Design

**Optimistic writes** — already done in `awardXP`: local state is updated before the Supabase insert. No change needed here ✅.

**Realtime subscription** — add in `useXPStore` (or a dedicated `useSessionSync` hook mounted in `App`):

```ts
// Mounted once after sign-in
supabase
  .channel('sessions')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'sessions',
    filter: `user_id=eq.${userId}`,
  }, (payload) => {
    const incoming = mapRowToSessionEntry(payload.new)
    useXPStore.getState()._mergeSession(incoming)
  })
  .subscribe()
```

**`_mergeSession`** — only adds the row if its `id` doesn't already exist locally (deduplicates the optimistic write from the real-time echo).

**Channel cleanup:** Unsubscribe on sign-out in `useAuthStore`.

---

## 6. Mobile Platform Correctness

### Problem
- `100vh` clips on iOS Safari when the floating browser chrome is visible
- The entire mobile stylesheet is one large `@media (max-width: 900px)` block — hard to maintain as mobile gets more specific
- `BottomTabBar` doesn't account for iPhone notch / home indicator safe area

### Design

**`dvh` fix:**  
Replace every `height: 100vh` and `min-height: 100vh` in the mobile block with `100dvh`. `dvh` (dynamic viewport height) adapts to the visible viewport, not the full screen including browser chrome.

**Safe-area insets:**  
Add to `BottomTabBar` styles:
```css
.bottom-tab-bar {
  padding-bottom: calc(8px + env(safe-area-inset-bottom));
}
```
Also add `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` to `index.html` if not already present — required for `env()` to work.

**CSS organisation:**  
The monolithic `@media` block stays in one file (splitting into separate files adds import overhead with no real benefit at current scale). Instead, add clear section comments inside the existing block:

```css
/* ── App Shell ────────────────────────────────────── */
/* ── Topbar ───────────────────────────────────────── */
/* ── Timer Page ──────────────────────────────────── */
/* ── Stats Page ──────────────────────────────────── */
/* ── Bottom Tab Bar ──────────────────────────────── */
/* ── Sidebar Drawer ──────────────────────────────── */
/* ── Settings ────────────────────────────────────── */
```

This is enough organisation without introducing import chains.

---

## 7. Code Quality

Small targeted fixes. Each is one-line to five-line changes.

| Item | File | Fix |
|---|---|---|
| Tag cache invalidation | `useAuthStore.ts` | Call `useTagStore.getState().fetchTags(userId)` on sign-in alongside subjects |
| Command palette debounce | `CommandPalette.tsx` | Wrap filter in `useDeferredValue(query)` — zero-dep, built into React |
| Subject list shallow eq | `Sidebar.tsx` | `useSubjectStore(s => s.subjects, useShallow)` from `zustand/react/shallow` |
| Inline-add panel unmount | `Sidebar.tsx` | `{showAdd && <InlineAddPanel />}` — currently always mounted |
| Goal progress in store | `useGoalsStore.ts` | Export a `useGoalProgress(goalId)` selector that reads sessions + streak + XP; `GoalsPanel` calls the selector, not raw sessions |

---

## 8. Testing & Security

### Playwright Smoke Tests

**File:** `tests/e2e/smoke.spec.ts`

**Critical path to cover:**

```
1. Navigate to app → login page shown
2. Sign in with test credentials
3. Timer page loads, subject picker visible
4. Open new session modal, select subject, start timer
5. Wait for mock tick (override Date.now in test) → session completes
6. XP toast appears
7. Navigate to /stats → KPI row shows > 0 total minutes
8. Sign out → redirected to login
```

Use Playwright's `page.clock.install()` to fast-forward time without waiting real seconds.

**Config:** `playwright.config.ts` at project root, `baseURL: 'http://localhost:5173'`, single Chromium browser.

### Bundle Audit

Add to `package.json`:
```json
"scripts": {
  "analyze": "vite-bundle-visualizer"
}
```

Run once after implementation to verify no unexpected large deps (e.g. moment.js, lodash) crept in.

### Content-Security-Policy

Add `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; img-src 'self' data:; font-src 'self'"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
      ]
    }
  ]
}
```

`unsafe-inline` is required for Vite's injected styles in dev; review if you add a nonce-based approach later.

---

## Implementation Order

1. Stats extraction (§1) + memoization — unblocks all future stats work
2. XP unit tests (§2) — quick win, run before anything touches XP
3. Code quality fixes (§7) — small, safe, do alongside §1
4. Mobile platform correctness (§6) — fixes real bugs for existing users
5. Settings → Supabase (§3) — needed before polish sprint adds more settings
6. Goals → Supabase (§4) — needed before user-editable goals UI
7. Realtime subscription (§5) — last, since it depends on session model being stable
8. Testing & security (§8) — add Playwright after the above is stable; CSP and bundle audit are one-off tasks

---

## Files Created / Modified

| File | Change |
|---|---|
| `src/utils/stats.ts` | Add 5 new pure functions |
| `src/pages/StatsPage.tsx` | Replace inline derivation with `useMemo` + imported functions |
| `src/components/stats/*.tsx` | Move any leaked derivation up to StatsPage |
| `src/tests/xp.test.ts` | New — Vitest unit tests |
| `src/tests/stats.test.ts` | New — Vitest unit tests for stat functions |
| `src/store/useSettingsStore.ts` | Add `_importFromSupabase`, `_syncToSupabase` |
| `src/store/useGoalsStore.ts` | New store |
| `src/store/useXPStore.ts` | Add `_mergeSession` |
| `src/store/useAuthStore.ts` | Wire realtime subscribe/unsubscribe, goals fetch, tag refetch |
| `src/components/GoalsPanel.tsx` | Read from `useGoalsStore` |
| `src/styles/mobile.css` (or equivalent) | `dvh` fix, safe-area insets, section comments |
| `index.html` | Add `viewport-fit=cover` |
| `src/components/Sidebar.tsx` | Shallow eq, conditional inline-add panel |
| `src/components/CommandPalette.tsx` | `useDeferredValue` |
| `tests/e2e/smoke.spec.ts` | New — Playwright critical path |
| `playwright.config.ts` | New |
| `vercel.json` | New — CSP + security headers |
| `package.json` | Add `analyze` script |
| Supabase migrations | `user_prefs`, `goals` tables |
