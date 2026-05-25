# Stats Page — Audit & Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all correctness bugs, data inconsistencies, and display issues discovered in the stats page audit; add weekly/monthly bar-chart aggregation for longer ranges.

**Architecture:** All changes are confined to `src/pages/StatsPage.tsx` and `src/styles/stats.css`. No new files, no new stores. Each task is independently shippable.

**Tech Stack:** React 19, TypeScript, Zustand, CSS custom properties, no charting library (custom SVG/CSS).

---

## Audit Summary

Below is the complete catalogue of everything found. Tasks below fix them in priority order.

### 🔴 Bugs (incorrect data / display)

| # | Location | Issue |
|---|---|---|
| B1 | `fmtDate` (line 65) | `new Date("2024-01-15")` parses as **UTC midnight** → users west of UTC see the previous day in Records |
| B2 | `dailyBars` memo (line 320) | `const idx = sessions.findIndex(...)` is computed and **never used** — dead code |
| B3 | `dailyBars` memo (line 316) | `year` → 180 days shown (should be 365); `all` → 30 days shown (should aggregate all time) |
| B4 | `hourDaySummary` (line 463) | Peak hour 23 displays **"23:00 – 24:00"** — invalid time |
| B5 | `thisMonthMins` useMemo (line 557) | `thisMonthStart` is used inside the memo but **not in the dependency array** — stale at month boundary |
| B6 | `hourDaySummary` (line 445) | Entire raw grid recomputed **a second time**, already computed in `hourDayGrid` — wasted work |

### 🟡 Inconsistencies (wrong behaviour, not crashes)

| # | Location | Issue |
|---|---|---|
| I1 | Year heatmap (line 341) | Uses raw `sessions` — **ignores subject filter** entirely; also ignores range selector |
| I2 | Heatmap footer | Label says "Longest streak **in this period**" but period is always the fixed 52-week heatmap window regardless of the range selector |
| I3 | `subjectFilter` pill | Clicking the pill clears filter, but the pill with `dashed` border implies "no filter set" — UX is subtle; clicking an already-active filter row in the subjects list works correctly |

### 🟢 Minor / cosmetic

| # | Location | Issue |
|---|---|---|
| M1 | Filter bar | **Export** pill has no `onClick` — decorative only |
| M2 | `HIST_BUCKETS` (line 469) | Array defined inside the component body on every render — should be a module-level constant |
| M3 | Radar (line 417) | Capped at 5 subjects — subjects 6+ never appear anywhere in radar or legend |

---

## File Map

| File | Role |
|---|---|
| `src/pages/StatsPage.tsx` | All logic and JSX — all tasks touch this |
| `src/styles/stats.css` | Layout/visual only — touched in Task 6 only |

---

## Task 1 — Fix `fmtDate` timezone bug (B1)

**Files:**
- Modify: `src/pages/StatsPage.tsx:65-69`

The root cause: `new Date("2024-01-15")` interprets a date-only ISO string as UTC midnight.
In a UTC-5 timezone that becomes `2024-01-14 19:00` local time → `getDate()` returns 14.

Fix: append `T00:00` to force local-timezone parsing.

- [ ] **Step 1: Update `fmtDate`**

Replace lines 65-69:
```tsx
function fmtDate(iso: string): string {
  if (!iso) return '—'
  // Append T00:00 so the browser parses as local midnight, not UTC midnight
  const d = new Date(`${iso}T00:00`)
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}
```

- [ ] **Step 2: Verify in browser**

Open `/stats` → scroll to Goals & Records strip at the bottom right.
"Best day" and "Best week" dates should match the dates stored in the XP store.
If you're east of UTC the dates were already correct; west of UTC they were off by one — now fixed.

- [ ] **Step 3: Commit**
```
git add src/pages/StatsPage.tsx
git commit -m "fix(stats): parse date strings as local midnight in fmtDate"
```

---

## Task 2 — Remove dead code (B2) and fix `thisMonthStart` memo dep (B5)

**Files:**
- Modify: `src/pages/StatsPage.tsx:316-326`, `src/pages/StatsPage.tsx:554-561`

Two unrelated but tiny fixes — grouped because both are one-liners.

- [ ] **Step 1: Remove `idx` dead variable from `dailyBars`**

In the `dailyBars` useMemo, line 320 currently reads:
```tsx
const idx = sessions.findIndex(s => dateOf(s.completedAt) === ds) // quick membership check
```
Delete that line entirely. The variable `idx` is not used anywhere in the memo or JSX.

After removal the inner loop body should be:
```tsx
const daySessions = workSessions.filter(s => dateOf(s.completedAt) === ds)
const mins = daySessions.reduce((sum, s) => sum + sessionMins(s), 0)
return { ds, d: new Date(d), mins, isWeekend: isWeekendDate(d), isToday: i === numDays - 1 }
```

- [ ] **Step 2: Fix `thisMonthStart` memo dependency**

Currently `thisMonthStart` is computed by mutating a `new Date()` outside any hook:
```tsx
const thisMonthStart = new Date()
thisMonthStart.setDate(1)
thisMonthStart.setHours(0, 0, 0, 0)
const thisMonthMins = useMemo(() =>
  sessions.filter(s => s.type === 'work' && new Date(s.completedAt) >= thisMonthStart)
    .reduce((sum, s) => sum + sessionMins(s), 0),
  [sessions]   // ← thisMonthStart is used but not listed
)
```

Move `thisMonthStart` inside the memo so it's always fresh:
```tsx
const thisMonthMins = useMemo(() => {
  const start = new Date()
  start.setDate(1)
  start.setHours(0, 0, 0, 0)
  return sessions
    .filter(s => s.type === 'work' && new Date(s.completedAt) >= start)
    .reduce((sum, s) => sum + sessionMins(s), 0)
}, [sessions])
```

Also delete the three orphaned lines above it (the original `thisMonthStart` declaration).

- [ ] **Step 3: Commit**
```
git add src/pages/StatsPage.tsx
git commit -m "fix(stats): remove dead idx var; move thisMonthStart inside memo"
```

---

## Task 3 — Fix peak hour 23 display and deduplicate raw grid computation (B4, B6)

**Files:**
- Modify: `src/pages/StatsPage.tsx:445-466`

Two fixes in the same memo.

**B6**: `hourDaySummary` builds a full `raw` 7×24 grid from scratch even though `hourDayGrid` already built the same data (the quantised version). We need the raw (un-quantised) values for peak detection, so we can't reuse `hourDayGrid` directly — but we *can* restructure so both memos share the same raw computation.

The cleanest approach: compute one `rawGrid` memo, then derive `hourDayGrid` and `hourDaySummary` from it separately (each is trivially cheap from raw data).

- [ ] **Step 1: Extract shared raw grid**

Replace the two existing memos (`hourDayGrid` and `hourDaySummary`) with three:

```tsx
// ── hour × day raw grid (minutes per slot) ────────────────────────────────
const hourDayRaw = useMemo(() => {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const s of workSessions) {
    const d    = new Date(s.completedAt)
    const dow  = (d.getDay() + 6) % 7   // 0 = Mon
    const hour = d.getHours()
    grid[dow][hour] += sessionMins(s)
  }
  return grid
}, [workSessions])

// ── quantised heat levels (0–4) for rendering ─────────────────────────────
const hourDayGrid = useMemo(() => {
  const maxVal = Math.max(1, ...hourDayRaw.flat())
  return hourDayRaw.map(row => row.map(v => {
    if (v === 0) return 0
    const n = v / maxVal
    if (n >= 0.75) return 4
    if (n >= 0.5)  return 3
    if (n >= 0.25) return 2
    return 1
  }))
}, [hourDayRaw])

// ── peak hour + best day summary ──────────────────────────────────────────
const hourDaySummary = useMemo(() => {
  let peakMins = 0, peakHour = -1
  for (let h = 0; h < 24; h++) {
    const t = hourDayRaw.reduce((s, row) => s + row[h], 0)
    if (t > peakMins) { peakMins = t; peakHour = h }
  }

  const dayTotals = hourDayRaw.map((row, i) => ({
    day:   DAY_LABELS[i],
    total: row.reduce((a, b) => a + b, 0),
  }))
  const bestDay = [...dayTotals].sort((a, b) => b.total - a.total)[0]

  // Fix B4: hour 23 → "23:00 – 0:00", not "23:00 – 24:00"
  const nextHour = peakHour >= 0 ? (peakHour + 1) % 24 : -1
  return {
    peakHour: peakHour >= 0 ? `${peakHour}:00 – ${nextHour}:00` : '—',
    bestDay:  bestDay?.total > 0 ? bestDay.day : '—',
  }
}, [hourDayRaw])
```

- [ ] **Step 2: Verify in browser**

Open `/stats` → "When you study" panel → check "Peak hour" label. If you have sessions at 11 PM the value should now read "23:00 – 0:00" instead of "23:00 – 24:00". All other hours unchanged.

- [ ] **Step 3: Commit**
```
git add src/pages/StatsPage.tsx
git commit -m "fix(stats): dedupe raw hour grid; fix peak-hour-23 display"
```

---

## Task 4 — Fix bar chart resolution for `year` and `all` ranges (B3)

**Files:**
- Modify: `src/pages/StatsPage.tsx:314-332`

**Problem**: The bar chart shows individual daily bars, but:
- `year` → 180 days (6-month half-year, despite a 1-year filter)
- `all` → 30 days (only last month, despite all-time filter)

**Solution**: For `year` and `all`, aggregate into **weekly** buckets (Mon–Sun) so the chart remains readable. This gives ~52 bars for a year-range and a sensible window for all-time.

The `dailyBars` type needs a new optional field `weekLabel` when weekly; the `isToday` flag becomes `isCurrentWeek`.

- [ ] **Step 1: Replace `dailyBars` with a unified `chartBars` computation**

Delete the existing `dailyBars`, `maxDayMins`, `avgDayMins`, and `yMax` memos.

Add this block in their place (after the `prevWorkSessions` memo):

```tsx
// ── chart bars (daily for week/month/quarter; weekly for year/all) ─────────
type ChartBar = {
  label: string     // x-axis date label
  mins:  number
  isWeekend: boolean
  isHighlight: boolean  // today (daily) or current week (weekly)
  isWeekly: boolean
}

const chartBars = useMemo<ChartBar[]>(() => {
  const useWeekly = range === 'year' || range === 'all'

  if (!useWeekly) {
    const numDays = range === 'week' ? 7 : range === 'month' ? 30 : 90
    return Array.from({ length: numDays }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (numDays - 1 - i))
      const ds = toLocalDateStr(d)
      const mins = workSessions
        .filter(s => dateOf(s.completedAt) === ds)
        .reduce((sum, s) => sum + sessionMins(s), 0)
      return {
        label:       `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`,
        mins,
        isWeekend:   isWeekendDate(d),
        isHighlight: i === numDays - 1,
        isWeekly:    false,
      }
    })
  }

  // Weekly aggregation: last 52 weeks (year) or since earliest session (all)
  const WEEKS = range === 'year' ? 52 : (() => {
    if (workSessions.length === 0) return 52
    const earliest = workSessions.reduce(
      (min, s) => Math.min(min, new Date(s.completedAt).getTime()),
      Date.now()
    )
    const msAgo = Date.now() - earliest
    return Math.min(260, Math.ceil(msAgo / (7 * 86_400_000)) + 1)
  })()

  // Find the Monday of the current week
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  weekStart.setHours(0, 0, 0, 0)

  return Array.from({ length: WEEKS }, (_, i) => {
    const wStart = new Date(weekStart)
    wStart.setDate(weekStart.getDate() - (WEEKS - 1 - i) * 7)
    const wEnd = new Date(wStart)
    wEnd.setDate(wStart.getDate() + 7)

    const mins = workSessions
      .filter(s => {
        const t = new Date(s.completedAt)
        return t >= wStart && t < wEnd
      })
      .reduce((sum, s) => sum + sessionMins(s), 0)

    return {
      label:       `${MONTH_NAMES[wStart.getMonth()]} ${wStart.getDate()}`,
      mins,
      isWeekend:   false,
      isHighlight: i === WEEKS - 1,
      isWeekly:    true,
    }
  })
}, [workSessions, range])

const maxBarMins = useMemo(() => Math.max(60, ...chartBars.map(d => d.mins)), [chartBars])
const avgBarMins = useMemo(() => {
  const active = chartBars.filter(d => d.mins > 0)
  return active.length > 0
    ? Math.round(active.reduce((s, d) => s + d.mins, 0) / active.length)
    : 0
}, [chartBars])
const yMax = useMemo(() => Math.max(1, Math.ceil(maxBarMins / 60)), [maxBarMins])
```

- [ ] **Step 2: Update JSX to use `chartBars`**

In the "FOCUSED TIME BAR CHART" section replace every reference:
- `dailyBars` → `chartBars`
- `maxDayMins` → `maxBarMins`
- `avgDayMins` → `avgBarMins`
- `day.isToday` → `day.isHighlight`

Update the bar height calculation (unchanged formula, new variable names):
```tsx
const heightPct = (day.mins / (yMax * 60)) * 100
const cls = day.isHighlight ? 'today' : day.isWeekend ? 'weekend' : ''
```

Update the tooltip to show the bar label:
```tsx
<span className="s-bar-tip">
  {fmtMinsShort(day.mins)} · {day.label}
</span>
```

Update x-axis ticks (last line of bar chart section):
```tsx
<div className="s-x-axis">
  {(() => {
    const n = chartBars.length
    const ticks = n <= 7  ? [0, n - 1]
      : n <= 30 ? [0, Math.floor(n / 3), Math.floor(2 * n / 3), n - 1]
      : [0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(3 * n / 4), n - 1]
    return ticks.map(i => (
      <span key={i}>{chartBars[i].label.toUpperCase()}</span>
    ))
  })()}
</div>
```

Update the legend in the chart header — for weekly mode the "Weekend" entry is meaningless. Conditionally hide it:
```tsx
<div className="s-legend">
  <span className="lg-key"><span className="lg-swatch"/> {chartBars[0]?.isWeekly ? 'Week' : 'Weekday'}</span>
  {!chartBars[0]?.isWeekly && (
    <span className="lg-key"><span className="lg-swatch muted"/> Weekend</span>
  )}
  {avgBarMins > 0 && <span className="lg-key"><span className="lg-swatch line"/> avg</span>}
</div>
```

- [ ] **Step 3: Verify in browser**

Toggle each range button:
- **Week** → 7 daily bars
- **Month** → 30 daily bars
- **90 days** → 90 daily bars
- **Year** → ~52 weekly bars (Mon–Sun buckets), no weekend dimming
- **All time** → weekly bars back to earliest session (capped at 260 weeks / 5 years)

- [ ] **Step 4: Commit**
```
git add src/pages/StatsPage.tsx
git commit -m "fix(stats): weekly aggregation for year/all bar chart; fix numDays"
```

---

## Task 5 — Make year heatmap respect the subject filter (I1, I2)

**Files:**
- Modify: `src/pages/StatsPage.tsx:341-398`

Currently the heatmap memo uses `sessions` directly — the subject filter has no effect on it. Since the heatmap is always 52 weeks (it's an activity calendar, not a range-scoped chart), it cannot meaningfully respect the range selector — but it *should* respect the subject filter.

Also, the footer says "Longest streak **in this period**" which is misleading: it should say "Longest streak — last 52 weeks".

- [ ] **Step 1: Add `subjectFilter` to heatmap deps and filter accordingly**

In the heatmap memo, change the data-collection loop from using `sessions` to filtering by subject:

```tsx
const { heatWeeks, heatMonthLabels, activeDays, longestHeatStreak } = useMemo(() => {
  const minsPerDay = new Map<string, number>()
  for (const s of sessions) {
    if (s.type !== 'work') continue
    // Respect subject filter
    if (subjectFilter !== null && s.subjectId !== subjectFilter) continue
    const ds = dateOf(s.completedAt)
    minsPerDay.set(ds, (minsPerDay.get(ds) ?? 0) + sessionMins(s))
  }
  // ... rest of memo unchanged ...
}, [sessions, subjectFilter])   // ← add subjectFilter to deps
```

- [ ] **Step 2: Fix the misleading footer label**

In the JSX for the heatmap footer (around line 872), change:
```tsx
Longest streak in this period ·{' '}
```
to:
```tsx
Longest streak · last 12 months ·{' '}
```

- [ ] **Step 3: Verify in browser**

1. Open `/stats` with no subject filter — heatmap shows all activity.
2. Click a subject row in the Subjects panel — heatmap updates to show only that subject's days.
3. Click the "All subjects" pill — heatmap reverts to all activity.

- [ ] **Step 4: Commit**
```
git add src/pages/StatsPage.tsx
git commit -m "fix(stats): heatmap now respects subject filter; fix misleading streak label"
```

---

## Task 6 — Move `HIST_BUCKETS` to module level (M2)

**Files:**
- Modify: `src/pages/StatsPage.tsx:469-480`

Currently defined inside the component body, so a new array reference is created on every render. Harmless but wasteful.

- [ ] **Step 1: Cut `HIST_BUCKETS` out of the component and paste at module level**

Remove lines 469-480 from inside `StatsPage()`. Place the array just before the main component declaration (after the sub-components, before `export default function StatsPage`):

```tsx
// ─── histogram buckets (module-level constant) ────────────────────────────────
const HIST_BUCKETS = [
  { label: '≤5',  max: 5        },
  { label: '10',  max: 10       },
  { label: '15',  max: 15       },
  { label: '20',  max: 20       },
  { label: '25',  max: 25       },
  { label: '30',  max: 30       },
  { label: '40',  max: 40       },
  { label: '50',  max: 50       },
  { label: '60',  max: 60       },
  { label: '90+', max: Infinity },
]
```

- [ ] **Step 2: Verify TypeScript compiles**
```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**
```
git add src/pages/StatsPage.tsx
git commit -m "refactor(stats): move HIST_BUCKETS to module-level constant"
```

---

## Task 7 — Wire Export button (M1)

**Files:**
- Modify: `src/pages/StatsPage.tsx:651-656`

Export as a CSV of the currently filtered sessions (respects range and subject filter). No external library needed — `Blob` + `URL.createObjectURL`.

- [ ] **Step 1: Add `handleExport` function inside `StatsPage`**

Add after the `lastSession` memo:

```tsx
// ── export ─────────────────────────────────────────────────────────────────
function handleExport() {
  const rows = [
    ['Date', 'Subject', 'Duration (min)', 'XP'].join(','),
    ...workSessions.map(s => {
      const subj = subjects.find(x => x.id === s.subjectId)?.name ?? ''
      const mins = sessionMins(s)
      const date = dateOf(s.completedAt)
      return [date, subj, mins, s.xp].join(',')
    }),
  ]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `study-sessions-${range}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Wire the Export pill**

Find the Export pill in the filter bar (currently has `cursor: 'default'` and no onClick):
```tsx
<span className="s-pill" style={{ color: 'var(--text-mute)', cursor: 'default' }}>
```
Replace with:
```tsx
<span
  className="s-pill"
  style={{ cursor: 'pointer' }}
  onClick={handleExport}
  title={`Export ${workSessions.length} sessions as CSV`}
>
```

- [ ] **Step 3: Verify in browser**

1. Select "Week" range → click Export → CSV downloads with only that week's sessions.
2. Select a subject → click Export → CSV contains only that subject's sessions in the range.
3. Open the CSV and verify columns: Date, Subject, Duration (min), XP.

- [ ] **Step 4: Commit**
```
git add src/pages/StatsPage.tsx
git commit -m "feat(stats): wire Export button — downloads filtered sessions as CSV"
```

---

## Task 8 — Show all subjects in radar (up to 8) (M3)

**Files:**
- Modify: `src/pages/StatsPage.tsx:416-422`

Currently `radarData = subjectStats.slice(0, 5)` — subjects 6+ are invisible. With 8 axes the radar is still readable and the label font is tiny enough to fit.

- [ ] **Step 1: Increase the cap from 5 to 8**

```tsx
const radarData = useMemo(() =>
  subjectStats.slice(0, 8).map(s => ({
    ...s,
    pct: Math.round(s.mins / subjectTotalMins * 100),
  })),
  [subjectStats, subjectTotalMins]
)
```

- [ ] **Step 2: Verify visually**

With 6+ subjects the radar polygon should have 6+ axes, labels remain readable. With ≤ 5 subjects behaviour is unchanged.

- [ ] **Step 3: Commit**
```
git add src/pages/StatsPage.tsx
git commit -m "fix(stats): raise radar subject cap from 5 to 8"
```

---

## Task 9 — Remove "Stats" h1 heading (D1)

**Files:**
- Modify: `src/pages/StatsPage.tsx:663-664`

The `<h1>Stats</h1>` inside `.s-page-head` is redundant — the sidebar nav item is already highlighted when on this route, and the filter bar provides context. Removing it tightens the page header.

- [ ] **Step 1: Delete the h1**

Find the `.s-page-head` block (around line 662):
```tsx
<div className="s-page-head">
  <div>
    <h1>Stats</h1>
    <div className="s-head-sub">
```
Remove only the `<h1>Stats</h1>` line. The `.s-head-sub` div and the right-side last-session block stay.

- [ ] **Step 2: Remove orphaned h1 CSS**

In `src/styles/stats.css`, delete the `.s-page-head h1` rule block (currently ~lines 102–108):
```css
.s-page-head h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.018em;
  color: var(--text);
}
```

- [ ] **Step 3: Verify in browser**

Open `/stats` — the page header should show only the date range subtitle and last-session info, no "Stats" title.

- [ ] **Step 4: Commit**
```
git add src/pages/StatsPage.tsx src/styles/stats.css
git commit -m "fix(stats): remove redundant h1 Stats heading"
```

---

## Task 10 — Hide vertical scrollbar (D2)

**Files:**
- Modify: `src/styles/stats.css:86-92`

Keep scroll functionality, just make the scrollbar invisible. The current `.s-scroll` block already hides the webkit scrollbar thumb; we need to also set `scrollbar-width: none` for Firefox and fully suppress the webkit track.

- [ ] **Step 1: Replace the `.s-scroll` scrollbar rules**

Current (lines 86–92):
```css
.s-scroll::-webkit-scrollbar { width: 10px; }
.s-scroll::-webkit-scrollbar-thumb {
  background: var(--surface-3);
  border-radius: 8px;
  border: 2px solid var(--bg);
}
.s-scroll::-webkit-scrollbar-thumb:hover { background: var(--hairline-3); }
```

Replace with:
```css
/* Hidden scrollbar — scroll still works */
.s-scroll { scrollbar-width: none; }           /* Firefox */
.s-scroll::-webkit-scrollbar { display: none; } /* Webkit / Blink */
```

- [ ] **Step 2: Verify in browser**

Open `/stats` → scroll the content — it should scroll normally but no scrollbar track/thumb is visible.

- [ ] **Step 3: Commit**
```
git add src/styles/stats.css
git commit -m "fix(stats): hide vertical scrollbar on s-scroll"
```

---

## Task 11 — No horizontal scroll + centered content (D3)

**Files:**
- Modify: `src/styles/stats.css`

Two goals:
1. **No horizontal overflow** — the outer `.stats-page` shell should never produce a horizontal scrollbar.
2. **Centered content** — at wide viewports, the cards should be centered with a max-width rather than stretching edge-to-edge.

- [ ] **Step 1: Add `overflow-x: hidden` to `.stats-page`**

In the `.stats-page` rule (lines 7–14), add `overflow-x: hidden`:
```css
.stats-page {
  grid-area: main;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;        /* already present — keeps both axes */
}
```
`overflow: hidden` already covers both axes, so this is already set. The likely source of horizontal scroll is `.s-filter-bar` with `overflow-x: auto` leaking out, or `.s-heatmap` (which has `overflow-x: auto` intentionally for the scroll within the card). Confirm `overflow: hidden` on `.stats-page` is present and verify the heatmap scroll is contained.

- [ ] **Step 2: Add max-width + centering to `.s-scroll` content**

Wrap the scroll content in a centred inner div by adding a new rule rather than restructuring JSX — use padding as the centering mechanism with a max-width on `.s-scroll` itself:

```css
.s-scroll {
  /* existing: flex:1; min-height:0; overflow-y:auto; padding:16px 18px 32px */
  max-width: 1200px;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
  /* keep existing padding */
}
```

This centres the scroll container inside the `.stats-page` flex column at viewports wider than 1200 px. At narrower widths it fills edge-to-edge as before.

- [ ] **Step 3: Verify at multiple widths**

- Narrow window (< 900 px): content fills edge-to-edge, no horizontal scrollbar.
- Medium window (900–1200 px): fills edge-to-edge, no horizontal scrollbar.
- Wide window (> 1200 px): content is centred with equal left/right space.

- [ ] **Step 4: Commit**
```
git add src/styles/stats.css
git commit -m "fix(stats): prevent horizontal scroll; center content at wide viewports"
```

---

## Task 12 — Migrate Goals to left Sidebar (D4)

**Files:**
- Create: `src/components/GoalsPanel.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/pages/StatsPage.tsx`
- Modify: `src/styles/stats.css` (add `.sidebar-goals` wrapper rule)

**What moves:** the `.s-goals-list` block (3 goals + 3 progress bars). The Records strip stays in StatsPage.

**What stays:** the Records card in StatsPage becomes a standalone card titled "Records" with no goals list.

- [ ] **Step 1: Create `GoalsPanel.tsx`**

```tsx
// src/components/GoalsPanel.tsx
import { useMemo } from 'react'
import useXPStore      from '../store/useXPStore'
import useStreakStore, { toLocalDateStr, calcCurrentStreak } from '../store/useStreakStore'
import { xpToLevel, levelToXp, xpProgress } from '../utils/xp'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function sessionMins(s: { durationSecs: number | null }): number {
  return s.durationSecs ? Math.round(s.durationSecs / 60) : 25
}

export default function GoalsPanel() {
  const sessions      = useXPStore(s => s.sessions)
  const totalXP       = useXPStore(s => s.totalXP)
  const loginDates    = useStreakStore(s => s.loginDates)

  const loginDateSet  = useMemo(() => new Set(loginDates), [loginDates])
  const currentStreak = useMemo(() => calcCurrentStreak(loginDateSet), [loginDateSet])

  const level     = xpToLevel(totalXP)
  const nextLevel = level + 1
  const xpProg    = xpProgress(totalXP)
  const xpToNext  = levelToXp(nextLevel) - totalXP
  const xpGoalNext = levelToXp(nextLevel)
  const xpGoalPct  = Math.min(100, Math.round(xpProg * 100))

  const thisMonthMins = useMemo(() => {
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    return sessions
      .filter(s => s.type === 'work' && new Date(s.completedAt) >= start)
      .reduce((sum, s) => sum + sessionMins(s), 0)
  }, [sessions])

  const monthGoalMins = 60 * 40
  const monthGoalPct  = Math.min(100, Math.round(thisMonthMins / monthGoalMins * 100))

  const streakGoal    = Math.ceil((currentStreak + 1) / 5) * 5
  const streakGoalPct = Math.min(100, Math.round(currentStreak / streakGoal * 100))

  const now = new Date()

  return (
    <div className="sidebar-goals">
      <div className="sidebar-goals-head">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>
        </svg>
        Goals
        <span className="sidebar-goals-month">{MONTH_NAMES[now.getMonth()]} {now.getFullYear()}</span>
      </div>

      <div className="s-goals-list">
        {/* Monthly hours */}
        <div>
          <div className="s-goal-wrap">
            <div className="s-goal-badge" style={{
              background: `linear-gradient(160deg, color-mix(in oklab, var(--focus) 24%, var(--surface-3)), var(--surface-3))`,
              border: `1px solid color-mix(in oklab, var(--focus) 26%, var(--hairline-2))`,
              color: 'var(--focus)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
              </svg>
            </div>
            <div className="s-goal-body">
              <div className="gtitle">Study {Math.round(monthGoalMins / 60)}h this month</div>
              <div className="gsub">{monthGoalPct}% complete</div>
            </div>
            <div className="s-goal-val">
              <b>{Math.floor(thisMonthMins / 60)}h {String(thisMonthMins % 60).padStart(2,'0')}m</b>
            </div>
          </div>
          <div className="s-progress" style={{ marginTop: 8 }}>
            <div className="s-progress-fill" style={{
              width: `${monthGoalPct}%`,
              background: `linear-gradient(90deg, color-mix(in oklab, var(--focus) 50%, transparent), var(--focus))`,
              boxShadow: `0 0 8px color-mix(in oklab, var(--focus) 30%, transparent)`,
            }} />
          </div>
        </div>

        {/* Streak goal */}
        <div>
          <div className="s-goal-wrap">
            <div className="s-goal-badge" style={{
              background: `linear-gradient(160deg, color-mix(in oklab, var(--streak) 24%, var(--surface-3)), var(--surface-3))`,
              border: `1px solid color-mix(in oklab, var(--streak) 26%, var(--hairline-2))`,
              color: 'var(--streak)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2s4 4 4 8a4 4 0 0 1-1.5 3c.5-.7.5-1.8 0-2.5-1-1.5-2.5-1-2.5-3 0 2-2 2.5-3 4.5a4 4 0 1 0 7.5 2C16.5 18 12 22 12 22s-7-3-7-9c0-7 7-11 7-11z"/>
              </svg>
            </div>
            <div className="s-goal-body">
              <div className="gtitle">{streakGoal}-day streak</div>
              <div className="gsub">{streakGoal - currentStreak} more {streakGoal - currentStreak === 1 ? 'day' : 'days'} to go</div>
            </div>
            <div className="s-goal-val"><b>{currentStreak}</b> / {streakGoal}</div>
          </div>
          <div className="s-progress" style={{ marginTop: 8 }}>
            <div className="s-progress-fill" style={{
              width: `${streakGoalPct}%`,
              background: `linear-gradient(90deg, color-mix(in oklab, var(--streak) 50%, transparent), var(--streak))`,
              boxShadow: `0 0 8px color-mix(in oklab, var(--streak) 30%, transparent)`,
            }} />
          </div>
        </div>

        {/* XP level goal */}
        <div>
          <div className="s-goal-wrap">
            <div className="s-goal-badge" style={{
              background: `linear-gradient(160deg, color-mix(in oklab, var(--xp) 24%, var(--surface-3)), var(--surface-3))`,
              border: `1px solid color-mix(in oklab, var(--xp) 26%, var(--hairline-2))`,
              color: 'var(--xp)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>
              </svg>
            </div>
            <div className="s-goal-body">
              <div className="gtitle">Reach Level {nextLevel}</div>
              <div className="gsub">{xpToNext} XP to go</div>
            </div>
            <div className="s-goal-val"><b>{totalXP}</b> / {xpGoalNext} XP</div>
          </div>
          <div className="s-progress" style={{ marginTop: 8 }}>
            <div className="s-progress-fill" style={{
              width: `${xpGoalPct}%`,
              background: `linear-gradient(90deg, color-mix(in oklab, var(--xp) 50%, transparent), var(--xp))`,
              boxShadow: `0 0 8px color-mix(in oklab, var(--xp) 30%, transparent)`,
            }} />
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add CSS for `.sidebar-goals` wrapper**

In `src/styles/stats.css`, append at the bottom (before the `@media` rules):
```css
/* ── Goals panel in sidebar ─────────────────────────────────────────────────── */
.sidebar-goals {
  margin: 0 8px 8px;
  padding: 10px 10px 12px;
  border-top: 1px solid var(--hairline);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sidebar-goals-head {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-dim);
}
.sidebar-goals-month {
  margin-left: auto;
  font-family: 'Geist Mono', monospace;
  font-size: 10px;
  color: var(--text-mute);
}
```

- [ ] **Step 3: Import `GoalsPanel` into `Sidebar.tsx` and render it**

At the top of `src/components/Sidebar.tsx`, add the import:
```tsx
import GoalsPanel from './GoalsPanel'
```

Inside the Sidebar JSX, just before the user/sign-out footer section (when not collapsed), add:
```tsx
{!collapsed && <GoalsPanel />}
```

The exact insertion point will be just before the closing tag of the nav section or before the `.ni-foot` div — find the footer element and insert above it.

- [ ] **Step 4: Remove goals list from `StatsPage.tsx`**

In the Goals & Records card (`src/pages/StatsPage.tsx`), remove the entire `.s-goals-list` div (all 3 goal items + progress bars, approximately lines 1048–1151). Keep only the Records strip and update the card header:

Change the card `sc-label` from "Goals" to "Records":
```tsx
<span className="sc-label">
  <svg className="ic" .../>
  Records
</span>
```
Remove the `sc-meta` date span next to it (was showing the current month, no longer relevant for a Records card).

Also delete the now-unused computed values from StatsPage that are only needed by the goals: `monthGoalMins`, `monthGoalPct`, `streakGoal`, `streakGoalPct`, `xpGoalCurrent`, `xpGoalNext`, `xpGoalPct`. The Records strip still needs `records`, `longestStreak` — those stay.

- [ ] **Step 5: Verify**

1. Open any page (not /stats) — left sidebar shows Goals panel with 3 progress bars at the bottom.
2. Complete a session — goals update in real time everywhere (sidebar + any page).
3. Open `/stats` — Goals card is gone; its slot now shows only the Records strip with correct heading.
4. Collapse the sidebar — Goals panel is hidden. Expand — it reappears.

- [ ] **Step 6: Commit**
```
git add src/components/GoalsPanel.tsx src/components/Sidebar.tsx src/pages/StatsPage.tsx src/styles/stats.css
git commit -m "feat(sidebar): migrate Goals panel from /stats to left sidebar"
```

---

## Self-Review Checklist

**Spec coverage:**
- B1 fmtDate timezone → Task 1 ✅
- B2 dead code → Task 2 ✅
- B3 bar chart numDays → Task 4 ✅
- B4 peak hour 23 → Task 3 ✅
- B5 thisMonthStart dep → Task 2 ✅
- B6 duplicate raw grid → Task 3 ✅
- I1 heatmap subject filter → Task 5 ✅
- I2 misleading streak label → Task 5 ✅
- I3 subject filter pill UX → noted only (behaviour is acceptable, no code change needed)
- M1 Export → Task 7 ✅
- M2 HIST_BUCKETS → Task 6 ✅
- M3 radar cap → Task 8 ✅
- D1 remove h1 → Task 9 ✅
- D2 hide scrollbar → Task 10 ✅
- D3 no h-scroll + centred → Task 11 ✅
- D4 goals → sidebar → Task 12 ✅

**Placeholder scan:** No TBD/TODO present. All code blocks are complete and self-contained.

**Type consistency:**
- `ChartBar` defined in Task 4 and used only in Task 4 — consistent.
- `handleExport` defined and called in Task 7 — consistent.
- `hourDayRaw` introduced in Task 3, consumed by `hourDayGrid` and `hourDaySummary` in same task — consistent.
- `GoalsPanel` created in Task 12 Step 1, imported in Step 3 — consistent.
- CSS classes `.sidebar-goals*` defined in Task 12 Step 2, used in GoalsPanel JSX — consistent.
- `subjectFilter` already in scope — no changes to its type.

---

**Execution order recommendation:** Tasks 1–3 first (data correctness), then 4–5 (consistency), then 6–8 (polish), then 9–11 (layout), then 12 (goals migration — largest change). All tasks are independent and can be done in any order.
