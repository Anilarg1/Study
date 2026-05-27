# UX Polish Sprint — Design Spec

**Date:** 2026-05-28  
**Scope:** High-value user-facing improvements to existing features. No new feature domains.  
**Prerequisite:** Architecture Hardening spec should be complete first — several items here depend on the goals DB, settings sync, and stats module from that spec.  
**Priority order:** Listed in order from highest to lowest impact.

---

## 1. Loading Skeletons

### Problem
Async data loads (sessions, subjects, XP sync on sign-in) cause blank or partially-rendered UI for 200–800ms. No visual feedback that something is coming.

### Design

**New component:** `src/components/Skeleton.tsx`

```tsx
interface SkeletonProps {
  width?:  string | number
  height?: string | number
  radius?: number    // border-radius px, default 6
  className?: string
}
```

CSS shimmer using `@keyframes shimmer` with a moving `linear-gradient`. Single reusable class `.skeleton-shimmer`.

**Applied to:**

| Component | What shimmers |
|---|---|
| `KPIRow` | Four stat boxes (fixed width/height matching rendered size) |
| `RightRail` | Today tab — focus time number + session count |
| `RankCard` | Badge area + rank name |
| `SubjectBreakdown` | Three placeholder bars |
| `ActivityHeatmap` | A 7×12 grid of placeholder cells |

**Gate:** Each component checks `sessions.length === 0 && isLoading` (add an `isLoading: boolean` field to `useXPStore` set true on sign-in, false after `_importSessionsFromSupabase` resolves).

---

## 2. Animated XP Bar Fill

### Problem
XP bar snaps to new value instantly. A visible fill animation makes earned XP feel rewarding and legible.

### Design

Track previous XP value in the component that renders the bar (likely `XPBar.tsx` or wherever the rank progress bar is drawn).

```ts
const [displayXP, setDisplayXP] = useState(totalXP)
const prevXP = useRef(totalXP)

useEffect(() => {
  if (totalXP === prevXP.current) return
  prevXP.current = totalXP
  // Animate from old to new over 800ms using requestAnimationFrame
  const start = performance.now()
  const from = displayXP
  const to = totalXP
  function frame(now: number) {
    const t = Math.min((now - start) / 800, 1)
    const eased = 1 - Math.pow(1 - t, 3)   // ease-out cubic
    setDisplayXP(Math.round(from + (to - from) * eased))
    if (t < 1) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}, [totalXP])
```

`displayXP` drives the bar width calculation. The number label also counts up (already handled by tracking `displayXP`).

No CSS transitions on `width` — `requestAnimationFrame` gives precise control and avoids stale-closure issues with CSS transitions.

---

## 3. Clickable RunningTimerWidget

### Problem
The RunningTimerWidget in the RightRail shows a live countdown but can't be clicked to return to the timer.

### Design

Wrap the widget's outer `div` in a `button` (not `<Link>`) that calls `useNavigate('/timer')`. The pause/resume button stops propagation.

```tsx
<button
  className="running-timer-widget"
  onClick={() => navigate('/timer')}
  aria-label="Return to timer"
>
  ...
  <button onClick={e => { e.stopPropagation(); togglePause() }}>
    {running ? <PauseIcon /> : <PlayIcon />}
  </button>
</button>
```

Add `cursor: pointer` and a subtle `hover` background tint (2% opacity white overlay) so it reads as interactive. Add a small tooltip `title="Back to timer"` on the outer button.

---

## 4. Date Range Picker on Stats

### Problem
Stats page only offers `week | month | quarter | year | all` preset ranges via a tab strip. No way to inspect an arbitrary date window.

### Design

**Add `custom` to the `Range` type.** When `custom` is selected, two `<input type="date">` fields appear inline next to the tab strip.

**URL persistence:** Store selected range in URL search params so the view is shareable/bookmarkable:

```
/stats?range=month
/stats?range=custom&from=2026-04-01&to=2026-04-30
```

Read with `useSearchParams`, write with `setSearchParams`. Defaults to `week` if absent.

**Stats functions** (from Architecture Hardening §1) already accept a `DateRange` parameter — just pass the custom window.

**UX:** The two date inputs appear in a small inline row below the tab strip, styled to match the existing tab look. `from` max = `to`, `to` max = today. Selecting any preset clears the custom inputs.

---

## 5. User-Editable Goals UI

**Prerequisite:** Goals → Supabase (Architecture Hardening §4).

### Design

Add a pencil icon button to the `GoalsPanel` header. Clicking it expands an inline edit panel below the goals list (not a modal — keeps it lightweight).

**Editable fields (first iteration):**
- Monthly hours target (number input, default 40)
- Custom streak target (number input, default next-5 milestone)

Subject-specific goals (per-subject hour targets with exam dates) are deferred to a future spec — the DB schema already supports them via `subject_id` + `due_date`.

**Save behaviour:** Calls `useGoalsStore.upsertGoal`. Optimistic local update. Collapses the edit panel on save.

---

## 6. Focus Mode

### Problem
The sidebar and right rail take up significant horizontal space while studying. Users want to minimise distractions.

### Design

`F` key toggles focus mode. `Escape` always exits it.

**State:** A single boolean in `useSettingsStore`: `focusMode: boolean`. Not synced to Supabase — local device preference.

**CSS:**
```css
[data-focus-mode] .v2-nav,
[data-focus-mode] .v2-rail {
  display: none;
}

[data-focus-mode] .app-shell {
  grid-template-columns: 1fr;
}
```

Set `data-focus-mode` on `document.documentElement` when toggled.

**Exit button:** A small `×` button in the top-right corner of the timer area (visible only in focus mode). Clicking it clears focus mode. Label: "Exit focus" shown on hover.

**Keydown handler:** Mounted in `App.tsx` via `useEffect`. Guard: only trigger if the focused element is not an input/textarea (to avoid stealing `F` while typing).

---

## 7. Keyboard Shortcut Reference

### Problem
Existing shortcuts (`[` for sidebar, `Ctrl+K` for palette, `1/2/3` for timer mode) aren't discoverable.

### Design

`?` key opens a modal listing all shortcuts. Guard: not triggered if an input is focused.

**Data structure** (static, no DB):
```ts
const SHORTCUTS: { key: string; label: string; section: string }[] = [
  { section: 'Navigation', key: 'Ctrl+K',  label: 'Command palette' },
  { section: 'Navigation', key: '[',        label: 'Toggle sidebar' },
  { section: 'Timer',      key: 'Space',    label: 'Start / pause' },
  { section: 'Timer',      key: 'S',        label: 'Skip phase' },
  { section: 'Timer',      key: '1 / 2 / 3', label: 'Focus / Short break / Long break' },
  { section: 'Timer',      key: 'F',        label: 'Toggle focus mode' },
  { section: 'General',    key: '?',        label: 'Show shortcuts' },
  { section: 'General',    key: 'Esc',      label: 'Close / exit focus mode' },
]
```

Rendered as a simple two-column `<dl>` grouped by section. Modal uses the same backdrop/card style as existing modals. `Esc` closes it.

---

## 8. Timer Keyboard Shortcuts

### Problem
Starting and pausing the timer requires clicking. Keyboard-first users have no shortcut.

### Design

Add `useEffect` in `TimerPage.tsx` (not in the store — shortcuts are a UI concern):

```ts
useEffect(() => {
  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (e.key === ' ') {
      e.preventDefault()
      running ? pause() : start()
    }
    if (e.key === 's' || e.key === 'S') {
      skip()
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [running, start, pause, skip])
```

`Space` only works when `TimerPage` is mounted (not globally) to avoid accidental triggers from other pages.

---

## 9. Empty States

### Problem
When a user has no sessions, charts render as blank boxes with no explanation.

### Design

**New component:** `src/components/EmptyState.tsx`

```tsx
interface EmptyStateProps {
  icon:     React.ReactNode
  title:    string
  subtitle?: string
}
```

Centered layout, muted icon (32px), title in `--text`, subtitle in `--text-muted`. Same visual weight as the existing `.v2-card` empty states.

**Applied to:**

| Component | Title | Subtitle |
|---|---|---|
| `ActivityHeatmap` | "No sessions yet" | "Complete your first session to see activity" |
| Session history table | "No sessions in this range" | "Try a wider date range" |
| `SubjectBreakdown` | "No subject data" | "Assign a subject when starting a session" |
| RightRail today tab (0 sessions) | "Nothing yet today" | "Start a session to track your progress" |

---

## 10. Fuzzy Search in Command Palette

### Problem
Command palette uses exact prefix matching. Typing `mth` doesn't find `Mathematics`.

### Design

Replace the current filter with a lightweight fuzzy score — no new dependency.

```ts
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  let qi = 0, score = 0, consecutive = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 1 + consecutive * 2   // bonus for consecutive matches
      consecutive++
      qi++
    } else {
      consecutive = 0
    }
  }
  return qi === q.length ? score : -1   // -1 = no match
}
```

Filter items where `fuzzyScore > -1`, then sort descending by score. Items where the query matches at position 0 (prefix) naturally score highest.

---

## 11. Heatmap Cell → Filter

### Problem
Clicking a heatmap cell has no effect. Users want to drill into a specific day.

### Design

Add `filterDate: string | null` to local state in `StatsPage`. Pass it as a prop to all chart components.

**Heatmap:** Each cell gets `onClick={() => setFilterDate(date === filterDate ? null : date)}` — click to select, click again to clear. Selected cell gets a `ring` border (2px solid `--focus`).

**Charts when `filterDate` is set:**
- KPI row shows single-day stats
- Focus time chart highlights that day's bar
- Session histogram and subject breakdown filter to that day's sessions

**Clear:** An `×` button appears next to the range tab strip when `filterDate` is set — `"Filtered to May 26"` with a clear button.

---

## 12. Week-over-Week Deltas on KPI Row

### Problem
KPI numbers (total minutes, session count) have no context — users don't know if 3 h is good or bad relative to their usual.

### Design

Add delta indicators below each KPI value: `↑ 12%` (green) or `↓ 8%` (red/muted) vs the previous equivalent period.

`calcKPIs` (Architecture Hardening §1) already returns `prevTotalMins` and `prevSessionCount`. Compute:

```ts
const delta = prevValue === 0 ? null : Math.round((currentValue - prevValue) / prevValue * 100)
```

If `prevValue === 0` (no prior data), show nothing rather than ∞%.

Render as a small `<span>` below the main number in `--text-muted` at 11px. Arrow character (`↑`/`↓`) coloured green/red.

---

## 13. Browser Notifications

### Problem
If the user is in another tab when the timer ends, they miss it silently.

### Design

**Settings toggle:** `desktopAlerts` already exists in `useSettingsStore`. Wire it to `Notification.requestPermission()` when toggled on.

**Fire notification:** In `PomodoroTimer.tsx`, after session completes and chime plays:

```ts
if (desktopAlerts && document.visibilityState === 'hidden' && Notification.permission === 'granted') {
  new Notification('Session complete', {
    body: mode === 'work' ? `+${result.xp} XP earned` : 'Break time over',
    icon: '/favicon.ico',
  })
}
```

Only fires when the tab is not visible — no double-notification when the user is watching the timer.

**No service worker required** — `new Notification()` works in foreground-capable browsers (Chrome, Edge, Firefox desktop). Safari on iOS doesn't support it; fail silently.

---

## 14. Volume Slider (replaces mute toggle)

### Problem
Sound can only be toggled on/off. Users may want quiet chimes without full mute.

### Design

Add `soundVolume: number` (0–100, default 80) to `useSettingsStore`. Add a `GainNode` to `src/lib/chime.ts`:

```ts
let gainNode: GainNode | null = null

function getGain(ctx: AudioContext): GainNode {
  if (!gainNode) {
    gainNode = ctx.createGain()
    gainNode.connect(ctx.destination)
  }
  return gainNode
}
```

`playNote` connects to `gainNode` instead of `ctx.destination`. Gain value = `soundVolume / 100`.

**Settings UI:** Replace the mute toggle with a range input (`<input type="range" min={0} max={100}>`). Setting to 0 is equivalent to mute. Remove the separate mute toggle.

Export `setChimeVolume(volume: number)` from `chime.ts` so Settings can update the gain node immediately on slider change.

---

## 15. Different Chimes Per Phase + Warning Sound

### Problem
Focus and break completions play a different chime (already done — `playWorkChime` vs `playBreakChime` ✅). A 5-second warning sound before the timer ends would help users wrap up.

### Design

**5-second warning:** In `PomodoroTimer.tsx`'s tick loop, when `remaining === 5 && running`:

```ts
if (remaining === 5 && soundEnabled && !warningPlayed.current) {
  playChime('warning')
  warningPlayed.current = true
}
if (remaining > 5) warningPlayed.current = false   // reset for next session
```

**`playChime('warning')`** — add a soft single-note pulse to `chime.ts`: a short 440Hz sine at low gain (0.1). Brief enough not to be annoying.

---

## Implementation Order

1. **Empty states** (§9) — zero risk, immediate visual improvement
2. **Clickable RunningTimerWidget** (§3) — one-liner navigation change
3. **Timer keyboard shortcuts** (§8) — simple `useEffect`, high daily value
4. **Animated XP bar** (§2) — contained in one component
5. **Keyboard shortcut reference** (§7) — static data, simple modal
6. **Focus mode** (§6) — CSS + one store field
7. **Loading skeletons** (§1) — requires `isLoading` flag in XP store first
8. **Fuzzy search** (§10) — replace filter function in CommandPalette
9. **Week-over-week deltas** (§12) — requires Architecture Hardening §1 (stats module)
10. **Heatmap cell filter** (§11) — requires Architecture Hardening §1
11. **Date range picker** (§4) — requires Architecture Hardening §1
12. **User-editable goals** (§5) — requires Architecture Hardening §4 (goals DB)
13. **Browser notifications** (§13) — wire existing `desktopAlerts` toggle
14. **Volume slider** (§14) — requires chime.ts gain node
15. **Warning sound** (§15) — requires §14

---

## Files Created / Modified

| File | Change |
|---|---|
| `src/components/Skeleton.tsx` | New |
| `src/components/EmptyState.tsx` | New |
| `src/components/RunningTimerWidget.tsx` | Add navigation on click |
| `src/components/XPBar.tsx` (or equivalent) | `requestAnimationFrame` animation |
| `src/components/CommandPalette.tsx` | Fuzzy score filter |
| `src/components/GoalsPanel.tsx` | Editable goals UI (inline edit panel) |
| `src/components/stats/ActivityHeatmap.tsx` | Click-to-filter, empty state |
| `src/components/stats/KPIRow.tsx` | Delta indicators |
| `src/components/stats/SubjectBreakdown.tsx` | Empty state |
| `src/pages/StatsPage.tsx` | `filterDate` state, date range picker, URL params |
| `src/pages/TimerPage.tsx` | Space/S keydown handler |
| `src/store/useSettingsStore.ts` | `focusMode`, `soundVolume` fields |
| `src/store/useXPStore.ts` | `isLoading` field |
| `src/lib/chime.ts` | `GainNode`, `setChimeVolume`, warning chime |
| `src/App.tsx` | `?` shortcut handler, `data-focus-mode` toggle, focus mode exit button |
| `index.html` | Viewport meta if not already `viewport-fit=cover` |
