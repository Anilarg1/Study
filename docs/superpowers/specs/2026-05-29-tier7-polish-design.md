# Tier 7 Polish — Design Spec

**Date:** 2026-05-29
**Scope:** Six remaining UX improvements not covered by the Architecture Hardening or existing UX Polish Sprint specs. All items are self-contained except User-Editable Goals, which requires Architecture Hardening Task 3 (Goals DB).

---

## 1. Auto-Start Next Phase

### Problem
After each session ends, the user must manually click Start to begin the next phase (break or focus). This interrupts flow.

### Design

Add two boolean fields to `useSettingsStore`:
- `autoStartBreaks: boolean` — default `false` — auto-starts short/long breaks after work sessions
- `autoStartFocus: boolean` — default `false` — auto-starts focus after a break ends

**Settings UI:** Two toggles in the Timer section of Settings, below the duration sliders.

**Timer integration:** In `PomodoroTimer.tsx`'s `handleTick` callback, after `tick()` returns `true` (session done), read the new `mode` from the store (already advanced by `_advance()`) and call `start()` if the matching auto-start toggle is enabled. No change to the store — all logic stays in the component.

```ts
if (finished) {
  // existing: award XP, play chime, set toast
  const nextMode = useTimerStore.getState().mode   // already advanced
  if (autoStartBreaks && (nextMode === 'shortBreak' || nextMode === 'longBreak')) {
    start()
  } else if (autoStartFocus && nextMode === 'work') {
    start()
  }
}
```

**Settings sync:** `autoStartBreaks` and `autoStartFocus` are not device-local — include them in the Supabase `user_prefs` sync added by Architecture Hardening Task 2. They are NOT in `LOCAL_ONLY_KEYS`.

---

## 2. Daily Session Goal Display

### Problem
The four-pip row on the timer shows sessions-within-the-Pomodoro-cycle, not daily progress. Users have no way to see "I've done 3 sessions today, aiming for 6."

### Design

Add `dailySessionGoal: number` (default 4, range 1–20) to `useSettingsStore`.

**Timer UI:** Below the four pips, add a small label: `3 / 6 today`. Style: 10px, `var(--text-faint)`. Only shown when `dailySessionGoal > 0`.

**Compute `completedToday`:** Filter `useXPStore.sessions` for today's work sessions at the component level:

```ts
const completedToday = useMemo(() => {
  const today = toLocalDateStr()
  return sessions.filter(s => s.type === 'work' && dateOf(s.completedAt) === today).length
}, [sessions])
```

**Settings UI:** A number input in the Timer section: "Daily session goal" with a small description "0 = off".

---

## 3. Session Timeline on /stats

### Problem
The stats page shows aggregates (totals, charts) but no session-by-session log. Users can't see what they actually studied.

### Design

Add a new `<section>` at the bottom of the `/stats` scroll area, below the Histogram + Records row.

**Title:** "Session log"

**Contents:** A scrollable list (max-height: 320px, `overflow-y: auto`) of work sessions filtered by the current range and subject filter (same `workSessions` array already computed). Sessions shown newest-first.

**Each row shows:**
- Date + time (formatted: "May 28, 10:30")
- Subject color dot + name (or "—" if untagged)
- Duration (`25m`, `1h 10m`)
- XP badge (`+32 XP`)

**When empty:** Reuse the existing `<EmptyState>` component — title "No sessions in this range", subtitle "Try a wider range or clear filters".

**Pagination:** Show the first 50 rows; a "Show more" button loads the next 50. No virtualization needed — 50 rows is fast to render.

**Component:** New `src/components/stats/SessionTimeline.tsx`. Receives `sessions: SessionEntry[]` and `subjects: Subject[]` as props.

---

## 4. Rank-Up Modal Ceremony

### Problem
`RankUpToast` is a small corner toast. A tier promotion (e.g. Wanderer → Scholar) deserves a richer moment.

### Design

**Two tiers of celebration:**
- **Sub-rank up** (e.g. Scholar I → Scholar II): keep current toast, no change
- **Full tier promotion** (e.g. Scholar → Artisan): show a full-screen modal

**Modal layout:**
- Full-screen backdrop (`rgba(0,0,0,0.6)`, blur 4px) rendered in a React portal at `document.body`
- Centered card (420px wide, `var(--surface-2)` background, 20px radius)
- Top: "RANK UP" label in small caps, rank color
- Center: large `<RankBadge>` (96px) with a spring pop animation (`scale: 0 → 1.15 → 1` over 600ms)
- Previous rank → arrow → New rank name
- Subtitle: "You've reached [Tier Name]"
- Dismiss: a "Continue" button; also closes on backdrop click or `Esc`

**State:** Reuse `rankUpEvent` in `PomodoroTimer`. Modify `RankUpToast` to detect `isTierUp` and render either the toast or the modal depending on tier change.

**No new state:** The existing `RankUpEvent` type and `setRankUpEvent` call are unchanged.

---

## 5. XP History Chart

### Problem
The Progression card on `/stats` shows current rank and subject mastery but no sense of growth over time.

### Design

Add a small line chart to the Progression card, below the rank progress bar.

**Data:** Walk `sessions` (all time, not range-filtered) in chronological order, accumulating XP, and build a 30-point array of `{ date: string, xp: number }`.

```ts
const xpHistory = useMemo(() => {
  const sorted = [...sessions]
    .filter(s => s.type === 'work')
    .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime())

  const points: { date: string; xp: number }[] = []
  let running = 0
  for (const s of sorted) {
    running += s.xp
    const ds = dateOf(s.completedAt)
    const last = points[points.length - 1]
    if (last?.date === ds) {
      last.xp = running   // overwrite same-day
    } else {
      points.push({ date: ds, xp: running })
    }
  }
  return points.slice(-30)   // last 30 active days
}, [sessions])
```

**Chart:** SVG polyline. Width = card width (100%), height = 48px. X = date index, Y = XP value scaled to 0–48px. Line color = `var(--focus)`. No axes — just the curve with a 40% opacity fill area below it. Minimal: no labels, no tooltips.

**Empty state:** Hide the chart section entirely if `xpHistory.length < 2`.

---

## 6. Consistency Score on Stats KPI Row

### Problem
Stats show total minutes and session count but no single metric that captures "how regularly am I studying?"

### Design

**Formula:**
```
consistencyScore = round((activeDays / rangeDays) × 100)
```
Where `activeDays` = number of distinct days with at least one work session in range, `rangeDays` = number of days in the current range.

Clamped 0–100. For "All time" range, use `activeDays / max(1, daysSinceFirstSession)`.

**KPI card:** Add a fifth KPI card to the existing `.s-kpi-row` grid: label "Consistency", value `{score}%`, subtitle `{activeDays} active days`.

**Component:** Add a `calcConsistency` function to `src/utils/stats.ts`:

```ts
export function calcConsistency(
  workSessions: SessionEntry[],
  rangeStart: Date,
  rangeEnd: Date,
): { score: number; activeDays: number; rangeDays: number } {
  const rangeDays = Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000))
  const activeDaysSet = new Set(workSessions.map(s => dateOf(s.completedAt)))
  const activeDays = activeDaysSet.size
  const score = Math.min(100, Math.round((activeDays / rangeDays) * 100))
  return { score, activeDays, rangeDays }
}
```

---

## 7. User-Editable Goals UI

**Prerequisite:** Architecture Hardening Task 3 (Goals → Supabase) must be complete first.

### Design

Add a pencil icon (14px) to the `GoalsPanel` header, right-aligned. Clicking it expands an inline edit panel below the goals list.

**Edit panel:**
- Monthly hours target: `<input type="number" min={1} max={200}>` (reads `goals.find(g => g.type === 'monthly_hours')?.targetValue ?? 40`)
- Save button: calls `useGoalsStore.upsertGoal({ ...goal, targetValue: newValue })`
- Cancel button: collapses the panel, no save
- Collapse on successful save

No modal — inline form keeps it lightweight.

---

## Files Created / Modified

| File | Change |
|---|---|
| `src/store/useSettingsStore.ts` | Add `autoStartBreaks`, `autoStartFocus`, `dailySessionGoal` |
| `src/components/PomodoroTimer.tsx` | Auto-start logic after tick finishes; daily goal display |
| `src/components/Settings.tsx` | Toggle rows for auto-start; number input for daily goal |
| `src/components/stats/SessionTimeline.tsx` | New component |
| `src/pages/StatsPage.tsx` | Add SessionTimeline section; add Consistency KPI card; XP history data derivation |
| `src/utils/stats.ts` | Add `calcConsistency` |
| `src/components/RankUpToast.tsx` | Upgrade tier-up to full modal |
| `src/components/GoalsPanel.tsx` | Pencil icon + inline edit panel (requires arch hardening Task 3) |
| `src/tests/stats.test.ts` | Tests for `calcConsistency` |
