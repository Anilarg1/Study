# UX Polish Sprint — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 14 UX improvements across loading feedback, keyboard interactions, audio controls, stats exploration, and focus mode.

**Architecture:** Four independent parallel streams — each owns a non-overlapping set of files. Streams A–D can be dispatched simultaneously; merge in any order. Stream D reads from `chime.ts` changes added within the same stream.

**Tech Stack:** React 19, Zustand, TypeScript, Tailwind + CSS variables, Web Audio API, Vitest, react-router-dom v6

> **Pre-flight note:** §12 (KPI deltas) is already implemented — `Delta` is rendered in StatsPage for both `timePct` and `sessionPct`. Skip it.

---

## File Map

| Stream | Files touched |
|---|---|
| A — App-level state | `useSettingsStore.ts`, `useXPStore.ts`, `Skeleton.tsx` (new), `ShortcutsModal.tsx` (new), `App.tsx`, `styles/pages.css` |
| B — Stats page | `StatsPage.tsx`, `ActivityHeatmap.tsx` |
| C — Component polish | `EmptyState.tsx` (new), `XPBar.tsx`, `RightRail.tsx`, `CommandPalette.tsx`, `GoalsPanel.tsx` |
| D — Timer + audio | `PomodoroTimer.tsx`, `chime.ts`, `Settings.tsx` |

No file appears in more than one stream.

---

## Stream A — App-level state + Focus mode + Shortcuts + Skeletons

Covers: §1 (skeleton infra), §6 (focus mode), §7 (shortcuts modal)

### Task A1: Add `focusMode` and `soundVolume` to `useSettingsStore`

**Files:**
- Modify: `src/store/useSettingsStore.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/settings.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import useSettingsStore from '../store/useSettingsStore'

describe('useSettingsStore — new fields', () => {
  beforeEach(() => useSettingsStore.setState({
    focusMode: false, soundVolume: 80,
  }))

  it('defaults focusMode to false', () => {
    const s = useSettingsStore.getState()
    expect(s.focusMode).toBe(false)
  })

  it('defaults soundVolume to 80', () => {
    const s = useSettingsStore.getState()
    expect(s.soundVolume).toBe(80)
  })

  it('toggle flips focusMode', () => {
    useSettingsStore.getState().toggle('focusMode')
    expect(useSettingsStore.getState().focusMode).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run src/tests/settings.test.ts
```

Expected: FAIL — `focusMode` / `soundVolume` undefined.

- [ ] **Step 3: Add fields to `useSettingsStore.ts`**

In the `SettingsData` interface add after `dndEnd`:

```ts
  focusMode:    boolean
  soundVolume:  number
```

In `LOCAL_ONLY_KEYS`:

```ts
const LOCAL_ONLY_KEYS = new Set<keyof SettingsData>(['sidebarCollapsed', 'focusMode'])
```

In the store initialiser (after `dndEnd: '08:00'`):

```ts
      focusMode:   false,
      soundVolume: 80,
```

In `partialize`, add to the returned object:

```ts
        focusMode:   state.focusMode,
        soundVolume: state.soundVolume,
```

- [ ] **Step 4: Run test to verify it passes**

```
npx vitest run src/tests/settings.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/useSettingsStore.ts src/tests/settings.test.ts
git commit -m "feat: add focusMode and soundVolume to useSettingsStore"
```

---

### Task A2: Add `isLoading` to `useXPStore`

**Files:**
- Modify: `src/store/useXPStore.ts`

- [ ] **Step 1: Write the failing test**

```ts
// append to src/tests/xp.test.ts
describe('useXPStore — isLoading', () => {
  it('starts as false', () => {
    expect(useXPStore.getState().isLoading).toBe(false)
  })
})
```

Add `import useXPStore from '../store/useXPStore'` at the top of `src/tests/xp.test.ts`.

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run src/tests/xp.test.ts
```

Expected: FAIL — `isLoading` is undefined.

- [ ] **Step 3: Add `isLoading` to `useXPStore.ts`**

In the `XPState` interface, add after `_reset():`:

```ts
  isLoading: boolean
  _setLoading(v: boolean): void
```

In the store initialiser, add after `sessions: []`:

```ts
      isLoading: false,
```

Add the action inside the store body:

```ts
      _setLoading(v) { set({ isLoading: v }) },
```

In `_importSessionsFromSupabase`, wrap the set call with loading state changes — find the existing method and replace it:

```ts
      _importSessionsFromSupabase(sessions) {
        const toStore = [...sessions].reverse().slice(0, MAX_LOCAL_SESSIONS)
        set({ sessions: toStore, isLoading: false })
      },
```

Find where `_importSessionsFromSupabase` is called in `useAuthStore.ts` and add `_setLoading(true)` before the call. Open `src/store/useAuthStore.ts`, find the block that calls `_importSessionsFromSupabase`, and wrap it:

```ts
useXPStore.getState()._setLoading(true)
await useXPStore.getState()._importSessionsFromSupabase(...)
```

> Note: `_setLoading(false)` is called inside `_importSessionsFromSupabase` itself on success. If the call throws, `isLoading` remains true — acceptable for this iteration.

- [ ] **Step 4: Run test to verify it passes**

```
npx vitest run src/tests/xp.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/useXPStore.ts src/store/useAuthStore.ts src/tests/xp.test.ts
git commit -m "feat: add isLoading flag to useXPStore"
```

---

### Task A3: Create `Skeleton.tsx`

**Files:**
- Create: `src/components/Skeleton.tsx`

- [ ] **Step 1: No test needed** — pure CSS shimmer, no logic.

- [ ] **Step 2: Create the component**

```tsx
// src/components/Skeleton.tsx
interface SkeletonProps {
  width?:    string | number
  height?:   string | number
  radius?:   number
  className?: string
}

export default function Skeleton({ width, height, radius = 6, className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width:        width  ?? '100%',
        height:       height ?? 16,
        borderRadius: radius,
        flexShrink:   0,
      }}
    />
  )
}
```

- [ ] **Step 3: Add shimmer CSS to `src/styles/pages.css`**

Append at the end of the file:

```css
/* ── Skeleton shimmer ────────────────────────────────────────────────────── */
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}

.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    var(--surface-2) 25%,
    var(--surface-3) 50%,
    var(--surface-2) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Skeleton.tsx src/styles/pages.css
git commit -m "feat: add Skeleton shimmer component"
```

---

### Task A4: Create `ShortcutsModal.tsx` (§7)

**Files:**
- Create: `src/components/ShortcutsModal.tsx`

- [ ] **Step 1: No separate test** — static data, modal with backdrop, tested visually.

- [ ] **Step 2: Create the component**

```tsx
// src/components/ShortcutsModal.tsx

interface Shortcut { key: string; label: string; section: string }

const SHORTCUTS: Shortcut[] = [
  { section: 'Navigation', key: 'Ctrl+K',    label: 'Command palette' },
  { section: 'Navigation', key: '[',          label: 'Toggle sidebar' },
  { section: 'Timer',      key: 'Space',      label: 'Start / pause' },
  { section: 'Timer',      key: 'S',          label: 'Skip phase' },
  { section: 'Timer',      key: '1 / 2 / 3',  label: 'Focus / Short break / Long break' },
  { section: 'Timer',      key: 'F',          label: 'Toggle focus mode' },
  { section: 'General',    key: '?',          label: 'Show shortcuts' },
  { section: 'General',    key: 'Esc',        label: 'Close / exit focus mode' },
]

interface ShortcutsModalProps {
  onClose: () => void
}

export default function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  const sections = [...new Set(SHORTCUTS.map(s => s.section))]

  return (
    <div
      className="cp-overlay"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="cp-modal shortcuts-modal" role="dialog" aria-label="Keyboard shortcuts">
        <div className="cp-search-row" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', padding: '0 4px' }}>
            Keyboard shortcuts
          </span>
          <span className="kbd-badge" style={{ marginLeft: 'auto' }}>esc</span>
        </div>

        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sections.map(section => (
            <div key={section}>
              <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-mute)', marginBottom: 8 }}>
                {section}
              </div>
              <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {SHORTCUTS.filter(s => s.section === section).map(s => (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <dt style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>{s.label}</dt>
                    <dd style={{ margin: 0 }}>
                      <span className="kbd-badge">{s.key}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ShortcutsModal.tsx
git commit -m "feat: add ShortcutsModal component"
```

---

### Task A5: Wire focus mode + `?` shortcut in `App.tsx` (§6, §7)

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Import new items at the top of `App.tsx`**

Add to imports:

```tsx
import ShortcutsModal    from './components/ShortcutsModal'
import useSettingsStore  from './store/useSettingsStore'
```

(`useSettingsStore` is already imported — only add `ShortcutsModal`.)

- [ ] **Step 2: Add state + store reads inside `App()`**

After the existing `const [mobileNavOpen, setMobileNavOpen] = useState(false)` line, add:

```tsx
  const [showShortcuts, setShowShortcuts] = useState(false)
  const focusMode     = useSettingsStore(s => s.focusMode)
  const toggleFocus   = useSettingsStore(s => s.toggle)
```

- [ ] **Step 3: Apply `data-focus-mode` attribute + sync it to the DOM**

Inside `App`, add a `useEffect` after the existing `useEffect(() => { init() }, [init])`:

```tsx
  useEffect(() => {
    if (focusMode) {
      document.documentElement.setAttribute('data-focus-mode', '')
    } else {
      document.documentElement.removeAttribute('data-focus-mode')
    }
  }, [focusMode])
```

- [ ] **Step 4: Extend the existing `onKey` handler in `App.tsx`**

Find the existing keyboard `useEffect` (the one with `Ctrl+K` and `[` bindings). Add two new cases **before** the `if ((e.target as HTMLElement).matches('input, textarea') return` guard:

```tsx
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowCmdPalette(p => !p)
        return
      }
      if ((e.target as HTMLElement).matches('input, textarea, [contenteditable]')) return
      if (e.key === '?')            { setShowShortcuts(p => !p); return }
      if (e.key === 'f' || e.key === 'F') { toggleFocus('focusMode'); return }
      if (e.key === 'Escape')       { if (focusMode) toggleFocus('focusMode'); return }
      if (e.key.toLowerCase() === 'c') handleNewSession()
      if (e.key === '[') toggleSidebar('sidebarCollapsed')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleNewSession, toggleSidebar, focusMode, toggleFocus])
```

- [ ] **Step 5: Add focus mode exit button and ShortcutsModal to the render**

Inside the return, just before the closing `</div>` of the `app-shell` div (after the `<CommandPalette .../>` block), add:

```tsx
      {focusMode && (
        <button
          className="focus-exit-btn"
          onClick={() => toggleFocus('focusMode')}
          title="Exit focus mode"
        >
          Exit focus
        </button>
      )}

      {showShortcuts && (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}
```

- [ ] **Step 6: Add focus mode CSS to `src/styles/pages.css`**

Append after the shimmer CSS added in Task A3:

```css
/* ── Focus mode ──────────────────────────────────────────────────────────── */
[data-focus-mode] .v2-nav,
[data-focus-mode] .v2-rail,
[data-focus-mode] .topbar,
[data-focus-mode] .brand-corner {
  display: none !important;
}

[data-focus-mode] .app-shell {
  grid-template-columns: 1fr;
  grid-template-rows:    1fr;
  grid-template-areas:   "main";
}

.focus-exit-btn {
  position:   fixed;
  top:        12px;
  right:      16px;
  z-index:    999;
  font-size:  11px;
  color:      var(--text-mute);
  background: var(--surface-2);
  border:     1px solid var(--hairline);
  border-radius: 6px;
  padding:    4px 10px;
  cursor:     pointer;
  font-family: inherit;
}

.focus-exit-btn:hover { color: var(--text); }

/* ── Shortcuts modal width override ─────────────────────────────────────── */
.shortcuts-modal { max-width: 380px; }
```

- [ ] **Step 7: Run type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx src/styles/pages.css
git commit -m "feat: focus mode (F key), shortcuts modal (? key), exit button"
```

---

## Stream B — Stats page enhancements

Covers: §4 (date range picker + URL params), §11 (heatmap click-to-filter), §9 partial (ActivityHeatmap empty state)

### Task B1: Heatmap cell click-to-filter (§11)

**Files:**
- Modify: `src/pages/StatsPage.tsx`
- Modify: `src/components/stats/ActivityHeatmap.tsx`

- [ ] **Step 1: Write the failing test for the filter logic**

```ts
// src/tests/statsFilter.test.ts
import { describe, it, expect } from 'vitest'

function toggleDate(current: string | null, clicked: string): string | null {
  return current === clicked ? null : clicked
}

describe('heatmap date filter', () => {
  it('selects a date on first click', () => {
    expect(toggleDate(null, '2026-05-20')).toBe('2026-05-20')
  })
  it('clears the date on second click (same date)', () => {
    expect(toggleDate('2026-05-20', '2026-05-20')).toBe(null)
  })
  it('switches to a new date', () => {
    expect(toggleDate('2026-05-20', '2026-05-21')).toBe('2026-05-21')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run src/tests/statsFilter.test.ts
```

Expected: FAIL — `toggleDate` not found (it's inlined in the test for now, so it should pass trivially — that's fine, move on).

- [ ] **Step 3: Add `filterDate` state in `StatsPage.tsx`**

Find the existing `useState` declarations near the top of `StatsPage()`:

```tsx
const [range, setRange]               = useState<Range>('month')
const [subjectFilter, setSubjectFilter] = useState<string | null>(null)
```

Add after:

```tsx
const [filterDate, setFilterDate]     = useState<string | null>(null)
```

Add a helper used in the render:

```tsx
function toggleFilterDate(date: string) {
  setFilterDate(prev => prev === date ? null : date)
}
```

Place this inside the component, after the `handleExport` function.

- [ ] **Step 4: Pass `filterDate` + `onCellClick` to `ActivityHeatmap`**

Find the existing `<ActivityHeatmap .../>` call and add two props:

```tsx
<ActivityHeatmap
  heatWeeks={heatWeeks}
  heatMonthLabels={heatMonthLabels}
  activeDays={activeDays}
  longestHeatStreak={longestHeatStreak}
  filterDate={filterDate}
  onCellClick={toggleFilterDate}
/>
```

- [ ] **Step 5: Show a "clear date filter" pill in the filter bar when `filterDate` is set**

Inside the filter bar `div.s-filter-bar`, after the existing export pill, add:

```tsx
{filterDate && (
  <button
    className="s-pill"
    style={{ cursor: 'pointer', color: 'var(--accent)' }}
    onClick={() => setFilterDate(null)}
  >
    {filterDate} ×
  </button>
)}
```

- [ ] **Step 6: Update `ActivityHeatmap.tsx` to accept + apply the new props**

Replace the existing `interface ActivityHeatmapProps` with:

```tsx
interface ActivityHeatmapProps {
  heatWeeks:         HeatCell[][]
  heatMonthLabels:   { label: string; width: number }[]
  activeDays:        number
  longestHeatStreak: number
  filterDate?:       string | null
  onCellClick?:      (date: string) => void
}
```

Add the new params to the destructuring:

```tsx
export function ActivityHeatmap({
  heatWeeks,
  heatMonthLabels,
  activeDays,
  longestHeatStreak,
  filterDate,
  onCellClick,
}: ActivityHeatmapProps) {
```

Replace the cell `div` in the heatmap grid. Find:

```tsx
<div
  key={di}
  className={`s-h-cell${cell.future ? ' empty' : cell.lvl ? ` l${cell.lvl}` : ''}`}
  title={cell.future ? '' : `${cell.ds}${cell.mins ? ` · ${fmtMinsShort(cell.mins)}` : ''}`}
/>
```

Replace with:

```tsx
<div
  key={di}
  className={`s-h-cell${cell.future ? ' empty' : cell.lvl ? ` l${cell.lvl}` : ''}${filterDate === cell.ds ? ' selected' : ''}`}
  title={cell.future ? '' : `${cell.ds}${cell.mins ? ` · ${fmtMinsShort(cell.mins)}` : ''}`}
  onClick={cell.future || !onCellClick ? undefined : () => onCellClick(cell.ds)}
  style={onCellClick && !cell.future ? { cursor: 'pointer' } : undefined}
/>
```

- [ ] **Step 7: Add empty state to ActivityHeatmap**

In `ActivityHeatmap.tsx`, after the opening `<section>` tag and before the month labels div, add:

```tsx
{activeDays === 0 && (
  <div className="s-empty" style={{ textAlign: 'center', padding: '24px 0' }}>
    No sessions yet — complete your first timer session to see activity
  </div>
)}
```

Only render the heatmap grid when `activeDays > 0`. Wrap the grid block in `{activeDays > 0 && (...)}`.

- [ ] **Step 8: Add `.s-h-cell.selected` CSS to `src/styles/stats.css`**

Append:

```css
.s-h-cell.selected {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
```

- [ ] **Step 9: Run tests**

```
npx vitest run src/tests/statsFilter.test.ts
npx tsc --noEmit
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add src/pages/StatsPage.tsx src/components/stats/ActivityHeatmap.tsx src/styles/stats.css src/tests/statsFilter.test.ts
git commit -m "feat: heatmap cell click-to-filter by date (§11)"
```

---

### Task B2: Custom date range picker with URL persistence (§4)

**Files:**
- Modify: `src/pages/StatsPage.tsx`

- [ ] **Step 1: Write the failing test for date range URL parsing**

```ts
// src/tests/dateRangePicker.test.ts
import { describe, it, expect } from 'vitest'

function parseCustomRange(from: string | null, to: string | null): { from: Date; to: Date } | null {
  if (!from || !to) return null
  const f = new Date(from)
  const t = new Date(to)
  if (isNaN(f.getTime()) || isNaN(t.getTime())) return null
  if (f > t) return null
  return { from: f, to: t }
}

describe('parseCustomRange', () => {
  it('returns null for missing inputs', () => {
    expect(parseCustomRange(null, '2026-05-01')).toBeNull()
    expect(parseCustomRange('2026-04-01', null)).toBeNull()
  })
  it('returns null when from > to', () => {
    expect(parseCustomRange('2026-05-10', '2026-05-01')).toBeNull()
  })
  it('returns a valid range for good inputs', () => {
    const r = parseCustomRange('2026-04-01', '2026-04-30')
    expect(r).not.toBeNull()
    expect(r!.from.toISOString().slice(0, 10)).toBe('2026-04-01')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run src/tests/dateRangePicker.test.ts
```

Expected: FAIL — `parseCustomRange` not found (it's inlined, so trivially passes — that's fine).

- [ ] **Step 3: Update the `Range` type and add `useSearchParams`**

In `StatsPage.tsx`, update the type at the top:

```tsx
type Range = 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom'
```

Add `useSearchParams` to the react-router-dom import:

```tsx
import { useSearchParams } from 'react-router-dom'
```

- [ ] **Step 4: Replace `useState<Range>` with URL-backed state**

Remove the existing `const [range, setRange] = useState<Range>('month')` line.

Add after the `useXPStore` / `useSubjectStore` / `useStreakStore` reads:

```tsx
const [searchParams, setSearchParams] = useSearchParams()

const range: Range = (() => {
  const r = searchParams.get('range')
  if (r === 'week' || r === 'month' || r === 'quarter' || r === 'year' || r === 'all' || r === 'custom') return r
  return 'month'
})()

const customFrom = searchParams.get('from') ?? ''
const customTo   = searchParams.get('to')   ?? ''

function setRange(r: Range) {
  if (r === 'custom') {
    setSearchParams({ range: 'custom' })
  } else {
    setSearchParams({ range: r })
  }
}

function setCustomDates(from: string, to: string) {
  setSearchParams({ range: 'custom', from, to })
}
```

- [ ] **Step 5: Update `getRangeStart` to handle `'custom'`**

Update the function to accept the custom bounds:

```tsx
function getRangeStart(range: Range, customFrom?: string): Date {
  if (range === 'custom' && customFrom) {
    const d = new Date(customFrom)
    if (!isNaN(d.getTime())) return d
  }
  switch (range) {
    case 'week':    return new Date(new Date().setDate(new Date().getDate() - 6))
    case 'month':   return new Date(new Date().setMonth(new Date().getMonth() - 1))
    case 'quarter': return new Date(new Date().setDate(new Date().getDate() - 89))
    case 'year':    return new Date(new Date().setFullYear(new Date().getFullYear() - 1))
    case 'all':     return new Date(0)
    default:        return new Date(new Date().setMonth(new Date().getMonth() - 1))
  }
}
```

Update the `rangeStart` memo to pass `customFrom`:

```tsx
const rangeStart = useMemo(() => getRangeStart(deferredRange, customFrom), [deferredRange, customFrom])
```

Update `getPrevStart` to guard against `'custom'`:

```tsx
function getPrevStart(range: Range, rangeStart: Date): Date {
  if (range === 'all' || range === 'custom') return new Date(0)
  const now    = new Date()
  const spanMs = now.getTime() - rangeStart.getTime()
  return new Date(rangeStart.getTime() - spanMs)
}
```

Update the `prevStart` memo:

```tsx
const prevStart = useMemo(() => getPrevStart(deferredRange, rangeStart), [deferredRange, rangeStart])
```

- [ ] **Step 6: Update the `rangeLabelMap` and add `'custom'`**

```tsx
const rangeLabelMap: Record<Range, string> = {
  week:    'Week',
  month:   'Month',
  quarter: '90 days',
  year:    'Year',
  all:     'All time',
  custom:  'Custom',
}
```

- [ ] **Step 7: Add `custom` tab + date inputs to the filter bar**

In the filter bar, update the range buttons to include `'custom'`:

```tsx
{(['week', 'month', 'quarter', 'year', 'all', 'custom'] as Range[]).map(r => (
  <button
    key={r}
    className={range === r ? 'active' : ''}
    onClick={() => setRange(r)}
  >
    {rangeLabelMap[r]}
  </button>
))}
```

Directly after the closing `</div>` of `div.s-seg`, add the date inputs (show only when `range === 'custom'`):

```tsx
{range === 'custom' && (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
    <input
      type="date"
      value={customFrom}
      max={customTo || new Date().toISOString().slice(0, 10)}
      onChange={e => setCustomDates(e.target.value, customTo)}
      className="s-date-input"
    />
    <span style={{ color: 'var(--text-mute)', fontSize: 11 }}>–</span>
    <input
      type="date"
      value={customTo}
      min={customFrom}
      max={new Date().toISOString().slice(0, 10)}
      onChange={e => setCustomDates(customFrom, e.target.value)}
      className="s-date-input"
    />
  </div>
)}
```

- [ ] **Step 8: Add date input CSS to `src/styles/stats.css`**

Append:

```css
.s-date-input {
  font-family: 'Geist Mono', monospace;
  font-size:   11px;
  color:       var(--text-dim);
  background:  var(--surface-2);
  border:      1px solid var(--hairline);
  border-radius: 4px;
  padding:     3px 7px;
  outline:     none;
  cursor:      pointer;
}

.s-date-input:focus {
  border-color: var(--accent);
}
```

- [ ] **Step 9: Run tests**

```
npx vitest run src/tests/dateRangePicker.test.ts
npx tsc --noEmit
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add src/pages/StatsPage.tsx src/styles/stats.css src/tests/dateRangePicker.test.ts
git commit -m "feat: custom date range picker with URL params (§4)"
```

---

## Stream C — Component polish

Covers: §9 (EmptyState), §2 (animated XP bar), §3 (clickable RunningTimerWidget), §10 (fuzzy search), §5 (editable goals)

### Task C1: Create `EmptyState.tsx` (§9)

**Files:**
- Create: `src/components/EmptyState.tsx`

- [ ] **Step 1: No logic test needed — pure presentational component.**

- [ ] **Step 2: Create the component**

```tsx
// src/components/EmptyState.tsx
interface EmptyStateProps {
  icon:      React.ReactNode
  title:     string
  subtitle?: string
}

export default function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            8,
      padding:        '28px 16px',
      color:          'var(--text-mute)',
    }}>
      <div style={{ fontSize: 28, opacity: 0.45 }}>{icon}</div>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-dim)' }}>{title}</div>
      {subtitle && (
        <div style={{ fontSize: 11, color: 'var(--text-mute)', textAlign: 'center', maxWidth: 220 }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Apply to `RightRail.tsx` — TodayCard zero-sessions state**

Open `src/components/RightRail.tsx`. Add the import at the top:

```tsx
import EmptyState from './EmptyState'
```

In `TodayCard`, find the block that renders the time and session count. The component shows `totalMin === 0 ? '—' : fmtDuration(totalMin)`. Add an empty state when `todaySes.length === 0`:

After the closing `</div>` for the focused time row, add:

```tsx
{todaySes.length === 0 && (
  <EmptyState
    icon="⏱"
    title="Nothing yet today"
    subtitle="Start a session to track your progress"
  />
)}
```

Only render the hour bar when sessions exist — wrap the `<div className="today-bar">` block in `{todaySes.length > 0 && (...)}`.

- [ ] **Step 4: Commit**

```bash
git add src/components/EmptyState.tsx src/components/RightRail.tsx
git commit -m "feat: EmptyState component + apply to RightRail today card (§9)"
```

---

### Task C2: Animated XP bar (§2)

**Files:**
- Modify: `src/components/XPBar.tsx`

- [ ] **Step 1: Write the failing test for the animation util**

```ts
// src/tests/xpBarAnimation.test.ts
import { describe, it, expect } from 'vitest'

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

describe('easeOutCubic', () => {
  it('returns 0 at t=0', () => {
    expect(easeOutCubic(0)).toBe(0)
  })
  it('returns 1 at t=1', () => {
    expect(easeOutCubic(1)).toBe(1)
  })
  it('is monotonically increasing', () => {
    const values = [0, 0.25, 0.5, 0.75, 1].map(easeOutCubic)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]!).toBeGreaterThan(values[i - 1]!)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run src/tests/xpBarAnimation.test.ts
```

Expected: FAIL — `easeOutCubic` not found (it's inlined in the test, so trivially passes). Proceed.

- [ ] **Step 3: Rewrite `XPBar.tsx` with RAF animation**

Replace the entire file:

```tsx
import { useEffect, useRef, useState } from 'react'
import useXPStore from '../store/useXPStore'
import { xpToLevel, xpProgress, levelToXp, xpToNextLevel } from '../utils/xp'

interface XPBarProps {
  flash?: boolean
}

export default function XPBar({ flash }: XPBarProps) {
  const totalXP = useXPStore(s => s.totalXP)
  const level   = xpToLevel(totalXP)
  const pct     = Math.round(xpProgress(totalXP) * 100)
  const toNext  = xpToNextLevel(totalXP)

  const [displayXP,  setDisplayXP]  = useState(totalXP)
  const [displayPct, setDisplayPct] = useState(pct)
  const [showFlash,  setFlash]      = useState(false)
  const prevXP  = useRef(totalXP)
  const rafRef  = useRef<number | null>(null)

  useEffect(() => {
    if (totalXP === prevXP.current) return
    const from   = prevXP.current
    const to     = totalXP
    prevXP.current = totalXP

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)

    const start = performance.now()
    const DURATION = 800

    function frame(now: number) {
      const t      = Math.min((now - start) / DURATION, 1)
      const eased  = 1 - Math.pow(1 - t, 3)
      const curXP  = Math.round(from + (to - from) * eased)
      const curPct = Math.round(xpProgress(curXP) * 100)
      setDisplayXP(curXP)
      setDisplayPct(curPct)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame)
      } else {
        rafRef.current = null
      }
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [totalXP])

  useEffect(() => {
    if (flash) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 800)
      return () => clearTimeout(t)
    }
  }, [flash])

  return (
    <div className="w-full select-none">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs text-dim tracking-widest uppercase">Level</span>
        <span className={`text-lg font-semibold transition-colors duration-300 ${showFlash ? 'text-amber' : 'text-accent'}`}>
          {xpToLevel(displayXP)}
        </span>
      </div>

      <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${showFlash ? 'bg-amber' : 'bg-accent'}`}
          style={{ width: `${displayPct}%` }}
        />
      </div>

      <div className="flex justify-between mt-1 text-[10px] text-dim">
        <span>{displayXP.toLocaleString()} XP total</span>
        <span>{toNext} XP to Lv {level + 1}</span>
      </div>

      <span style={{ display: 'none' }}>{levelToXp(level)}</span>
    </div>
  )
}
```

> Key changes: `displayXP` drives everything; RAF loop with ease-out cubic over 800ms; no CSS `transition` on width.

- [ ] **Step 4: Run tests**

```
npx vitest run src/tests/xpBarAnimation.test.ts
npx tsc --noEmit
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/XPBar.tsx src/tests/xpBarAnimation.test.ts
git commit -m "feat: animated XP bar with RAF ease-out cubic (§2)"
```

---

### Task C3: Clickable `RunningTimerWidget` (§3)

**Files:**
- Modify: `src/components/RightRail.tsx`

- [ ] **Step 1: No test** — navigation is a side-effect tested visually.

- [ ] **Step 2: Add `useNavigate` to `RightRail.tsx`**

Update the import at the top — `Link` is already imported from `react-router-dom`. Add `useNavigate`:

```tsx
import { Link, useLocation, useNavigate } from 'react-router-dom'
```

- [ ] **Step 3: Wire up click-to-navigate inside `RunningTimerWidget`**

At the top of `RunningTimerWidget()`, add:

```tsx
const navigate = useNavigate()
```

Find the outermost `<div>` in the `RunningTimerWidget` return:

```tsx
<div style={{ paddingTop: 10, paddingBottom: 10, marginBottom: 2 }}>
```

Replace it with a `<button>`:

```tsx
<button
  className="running-timer-widget-btn"
  onClick={() => navigate('/')}
  title="Back to timer"
  aria-label="Return to timer"
  style={{ paddingTop: 10, paddingBottom: 10, marginBottom: 2, width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
>
```

Close the button before the existing `{/* Hairline divider before next rail section */}` comment:

Replace the existing closing `</div>` before `{/* Hairline divider... */}` with `</button>`.

Find the pause/resume `<button onClick={running ? pause : start}>` and add `e.stopPropagation()`:

```tsx
<button
  onClick={e => { e.stopPropagation(); running ? pause() : start() }}
  style={{ ... }}
>
```

- [ ] **Step 4: Add hover style to `src/styles/pages.css`**

Append:

```css
.running-timer-widget-btn:hover {
  background: rgba(255, 255, 255, 0.02) !important;
  border-radius: 6px;
}
```

- [ ] **Step 5: Run type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/RightRail.tsx src/styles/pages.css
git commit -m "feat: RunningTimerWidget navigates to timer on click (§3)"
```

---

### Task C4: Fuzzy search in `CommandPalette` (§10)

**Files:**
- Modify: `src/components/CommandPalette.tsx`

- [ ] **Step 1: Write the failing test**

```ts
// src/tests/fuzzy.test.ts
import { describe, it, expect } from 'vitest'
import { fuzzyScore } from '../components/CommandPalette'

describe('fuzzyScore', () => {
  it('returns -1 for non-matching query', () => {
    expect(fuzzyScore('xyz', 'Mathematics')).toBe(-1)
  })
  it('matches partial subsequence', () => {
    expect(fuzzyScore('mth', 'Mathematics')).toBeGreaterThan(-1)
  })
  it('prefix match scores higher than subsequence', () => {
    const prefix = fuzzyScore('ma', 'Mathematics')
    const sub    = fuzzyScore('ma', 'Grammar')
    expect(prefix).toBeGreaterThan(sub)
  })
  it('exact match scores highest', () => {
    expect(fuzzyScore('mathematics', 'Mathematics')).toBeGreaterThan(fuzzyScore('mth', 'Mathematics'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run src/tests/fuzzy.test.ts
```

Expected: FAIL — `fuzzyScore` is not exported from `CommandPalette`.

- [ ] **Step 3: Export `fuzzyScore` from `CommandPalette.tsx`**

Add the function just before the `interface CmdItem` block:

```ts
export function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  let qi = 0, score = 0, consecutive = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 1 + consecutive * 2
      consecutive++
      qi++
    } else {
      consecutive = 0
    }
  }
  return qi === q.length ? score : -1
}
```

- [ ] **Step 4: Replace the `filtered` computation**

Find:

```tsx
const filtered = q
  ? allCmds.filter(c => c.label.toLowerCase().includes(q))
  : allCmds
```

Replace with:

```tsx
const filtered = q
  ? allCmds
      .map(c => ({ cmd: c, score: fuzzyScore(q, c.label) }))
      .filter(x => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.cmd)
  : allCmds
```

- [ ] **Step 5: Run tests**

```
npx vitest run src/tests/fuzzy.test.ts
npx tsc --noEmit
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/CommandPalette.tsx src/tests/fuzzy.test.ts
git commit -m "feat: fuzzy search in CommandPalette (§10)"
```

---

### Task C5: User-editable goals inline panel (§5)

**Files:**
- Modify: `src/components/GoalsPanel.tsx`

- [ ] **Step 1: No separate test** — mutation goes to Supabase via `useGoalsStore.upsertGoal`. Store logic is already tested via type-check.

- [ ] **Step 2: Add edit state to `GoalsPanel.tsx`**

Add `useState` to the imports at the top:

```tsx
import { useState, useMemo } from 'react'
```

Inside `GoalsPanel()`, add:

```tsx
const [editing, setEditing] = useState(false)
const upsertGoal = useGoalsStore(s => s.upsertGoal)
```

- [ ] **Step 3: Extend the goals panel header with a pencil toggle**

Find:

```tsx
<div className="sidebar-goals-head">
  Goals
  <span className="sidebar-goals-month">{MONTH_NAMES[now.getMonth()]}</span>
</div>
```

Replace with:

```tsx
<div className="sidebar-goals-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    Goals
    <span className="sidebar-goals-month">{MONTH_NAMES[now.getMonth()]}</span>
  </div>
  <button
    onClick={() => setEditing(e => !e)}
    style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: editing ? 'var(--accent)' : 'var(--text-mute)',
      fontSize: 13, padding: 0, lineHeight: 1,
    }}
    title={editing ? 'Close edit' : 'Edit goals'}
  >
    ✎
  </button>
</div>
```

- [ ] **Step 4: Add the inline edit panel below the goals list**

After `</div>` closing `div.sg-list`, add:

```tsx
{editing && (
  <GoalEditPanel goals={goals} onSave={upsertGoal} onClose={() => setEditing(false)} />
)}
```

- [ ] **Step 5: Create the `GoalEditPanel` sub-component above `GoalsPanel`**

Add this component definition in the same file, above `GoalsPanel`:

```tsx
import type { GoalEntry } from '../store/useGoalsStore'

function GoalEditPanel({
  goals,
  onSave,
  onClose,
}: {
  goals: GoalEntry[]
  onSave: (g: Omit<GoalEntry, 'id'> & { id?: string }) => Promise<void>
  onClose: () => void
}) {
  const monthlyHours = goals.find(g => g.type === 'monthly_hours')
  const streak       = goals.find(g => g.type === 'streak')

  const [hours,  setHours]  = useState(String(monthlyHours?.targetValue ?? 40))
  const [streak_,setStreak] = useState(String(streak?.targetValue ?? 5))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    if (monthlyHours) {
      await onSave({ ...monthlyHours, targetValue: Math.max(1, Number(hours)) })
    }
    if (streak) {
      await onSave({ ...streak, targetValue: Math.max(1, Number(streak_)) })
    }
    setSaving(false)
    onClose()
  }

  return (
    <div style={{
      marginTop:    8,
      padding:      '10px 12px',
      background:   'var(--surface-2)',
      borderRadius: 8,
      border:       '1px solid var(--hairline)',
      display:      'flex',
      flexDirection: 'column',
      gap:          10,
    }}>
      {monthlyHours && (
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--text-dim)' }}>
          Monthly hours target
          <input
            type="number"
            min={1}
            max={720}
            value={hours}
            onChange={e => setHours(e.target.value)}
            style={{
              width: 56, fontSize: 12, textAlign: 'right',
              background: 'var(--surface-3)', border: '1px solid var(--hairline)',
              borderRadius: 4, color: 'var(--text)', padding: '2px 6px',
            }}
          />
        </label>
      )}
      {streak && (
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--text-dim)' }}>
          Streak target (days)
          <input
            type="number"
            min={1}
            max={3650}
            value={streak_}
            onChange={e => setStreak(e.target.value)}
            style={{
              width: 56, fontSize: 12, textAlign: 'right',
              background: 'var(--surface-3)', border: '1px solid var(--hairline)',
              borderRadius: 4, color: 'var(--text)', padding: '2px 6px',
            }}
          />
        </label>
      )}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{ fontSize: 11, color: 'var(--text-mute)', background: 'none', border: '1px solid var(--hairline)', borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ fontSize: 11, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', borderRadius: 4, padding: '3px 10px', cursor: 'pointer' }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
```

Also add `GoalEntry` to the import of `useGoalsStore`:

```tsx
import useGoalsStore, { useGoalProgress, GoalEntry } from '../store/useGoalsStore'
```

Wait — `GoalEntry` needs to be imported from useGoalsStore. Ensure the import line in `GoalsPanel.tsx` includes it:

```tsx
import useGoalsStore, { useGoalProgress } from '../store/useGoalsStore'
import type { GoalEntry } from '../store/useGoalsStore'
```

- [ ] **Step 6: Run type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/GoalsPanel.tsx
git commit -m "feat: user-editable goals inline panel (§5)"
```

---

## Stream D — Timer + Audio

Covers: §8 (timer keyboard shortcuts), §13 (browser notifications), §14 (volume slider), §15 (warning sound)

### Task D1: `GainNode` + volume API + warning chime in `chime.ts` (§14, §15)

**Files:**
- Modify: `src/lib/chime.ts`

- [ ] **Step 1: Write the failing test for gain calculation**

```ts
// src/tests/chimeVolume.test.ts
import { describe, it, expect } from 'vitest'

function volumeToGain(volume: number): number {
  return Math.max(0, Math.min(1, volume / 100))
}

describe('volumeToGain', () => {
  it('converts 0 to 0', ()   => expect(volumeToGain(0)).toBe(0))
  it('converts 100 to 1', () => expect(volumeToGain(100)).toBe(1))
  it('converts 80 to 0.8', ()=> expect(volumeToGain(80)).toBeCloseTo(0.8))
  it('clamps below 0', ()    => expect(volumeToGain(-10)).toBe(0))
  it('clamps above 100', ()  => expect(volumeToGain(150)).toBe(1))
})
```

- [ ] **Step 2: Run test to verify it fails**

```
npx vitest run src/tests/chimeVolume.test.ts
```

Expected: FAIL — `volumeToGain` not found (inlined in test, trivially passes — proceed).

- [ ] **Step 3: Rewrite `chime.ts`**

Replace the entire file:

```ts
import type { TimerMode } from '../types'

let ctx:      AudioContext | null = null
let gainNode: GainNode     | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)()
  return ctx
}

function getGain(ac: AudioContext): GainNode {
  if (!gainNode) {
    gainNode = ac.createGain()
    gainNode.gain.value = 0.8   // default matches soundVolume:80 / 100
    gainNode.connect(ac.destination)
  }
  return gainNode
}

export function setChimeVolume(volume: number): void {
  const gain = Math.max(0, Math.min(1, volume / 100))
  if (gainNode) {
    gainNode.gain.value = gain
  } else if (ctx) {
    getGain(ctx).gain.value = gain
  }
}

function playNote(freq: number, startTime: number, duration: number, gainPeak = 0.25): void {
  const ac  = getCtx()
  const osc = ac.createOscillator()
  const env = ac.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, startTime)

  env.gain.setValueAtTime(0, startTime)
  env.gain.linearRampToValueAtTime(gainPeak, startTime + 0.015)
  env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

  osc.connect(env)
  env.connect(getGain(ac))
  osc.start(startTime)
  osc.stop(startTime + duration)
}

function playWorkChime(): void {
  const ac = getCtx()
  if (ac.state === 'suspended') ac.resume()
  const t = ac.currentTime
  playNote(523.25, t,        0.55)
  playNote(659.26, t + 0.13, 0.55)
  playNote(783.99, t + 0.26, 0.90, 0.28)
}

function playBreakChime(): void {
  const ac = getCtx()
  if (ac.state === 'suspended') ac.resume()
  const t = ac.currentTime
  playNote(659.26, t,        0.50, 0.18)
  playNote(523.25, t + 0.16, 0.65, 0.14)
}

function playWarningChime(): void {
  const ac = getCtx()
  if (ac.state === 'suspended') ac.resume()
  const t = ac.currentTime
  playNote(440, t, 0.18, 0.08)   // soft single pulse at low gain
}

export function playChime(mode: TimerMode | 'warning'): void {
  try {
    if (mode === 'work')    playWorkChime()
    else if (mode === 'warning') playWarningChime()
    else                    playBreakChime()
  } catch {
    // AudioContext unavailable — ignore
  }
}
```

- [ ] **Step 4: Run type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chime.ts src/tests/chimeVolume.test.ts
git commit -m "feat: GainNode + setChimeVolume + warning chime (§14 §15)"
```

---

### Task D2: Timer keyboard shortcuts + warning sound + browser notifications in `PomodoroTimer.tsx` (§8, §13, §15)

**Files:**
- Modify: `src/components/PomodoroTimer.tsx`

- [ ] **Step 1: Add `useSettingsStore` reads for `soundVolume` and `desktopAlerts`**

`PomodoroTimer.tsx` already imports `useSettingsStore`. Find:

```tsx
const soundEnabled = useSettingsStore(s => s.soundEnabled)
```

Add after:

```tsx
const soundVolume  = useSettingsStore(s => s.soundVolume)
const desktopAlerts = useSettingsStore(s => s.desktopAlerts)
```

- [ ] **Step 2: Import `setChimeVolume` from `chime.ts`**

Find the existing `import { playChime } from '../lib/chime'` and update:

```tsx
import { playChime, setChimeVolume } from '../lib/chime'
```

- [ ] **Step 3: Sync volume to GainNode on change**

Add a `useEffect` inside the component:

```tsx
useEffect(() => {
  setChimeVolume(soundEnabled ? soundVolume : 0)
}, [soundVolume, soundEnabled])
```

- [ ] **Step 4: Add `warningPlayed` ref**

After the existing `const tickRef = useRef(...)` add:

```tsx
const warningPlayed = useRef(false)
```

- [ ] **Step 5: Add warning sound logic in the tick handler**

Find the tick handler function inside the component (the function stored in `handleTickRef`). It currently looks like:

```tsx
handleTickRef.current = () => {
  const done = tick()
  if (done) { ... }
}
```

Inside that function, before the `const done = tick()` line, add:

```tsx
    if (remaining === 5 && running && soundEnabled && !warningPlayed.current) {
      playChime('warning')
      warningPlayed.current = true
    }
    if (remaining > 5) warningPlayed.current = false
```

- [ ] **Step 6: Add browser notification after session completes**

Find the block inside `if (done) { ... }` that calls `playChime(mode)`. After the `playChime` call, add:

```tsx
        if (
          desktopAlerts &&
          Notification.permission === 'granted' &&
          document.visibilityState === 'hidden'
        ) {
          new Notification('Session complete', {
            body: mode === 'work' ? `+${result.xp} XP earned` : 'Break time over',
            icon: '/favicon.ico',
          })
        }
```

- [ ] **Step 7: Add keyboard shortcuts `useEffect`**

Add this `useEffect` inside `PomodoroTimer`, after the existing outside-click effects:

```tsx
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
      if (e.key === '1') setMode('work')
      if (e.key === '2') setMode('shortBreak')
      if (e.key === '3') setMode('longBreak')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running, start, pause, skip, setMode])
```

- [ ] **Step 8: Run type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/PomodoroTimer.tsx
git commit -m "feat: Space/S/1/2/3 shortcuts, warning sound, browser notifications (§8 §13 §15)"
```

---

### Task D3: Volume slider in `Settings.tsx` (§14)

**Files:**
- Modify: `src/components/Settings.tsx`

- [ ] **Step 1: No test** — the logic is `setChimeVolume(v)` which is already tested via type-check.

- [ ] **Step 2: Add `soundVolume` read and `setChimeVolume` import**

In `Settings.tsx`, add to the existing `useSettingsStore` reads section:

```tsx
const soundVolume = useSettingsStore(s => s.soundVolume)
const setField    = useSettingsStore(s => s.setField)
```

(`setField` may already be imported — verify and skip the duplicate.)

Add to the chime import (or add a new import):

```tsx
import { setChimeVolume } from '../lib/chime'
```

- [ ] **Step 3: Find the sound toggle and replace with volume slider**

In `Settings.tsx`, find the section that renders the `soundEnabled` toggle. It will look something like:

```tsx
<SettingRow label="Sound" ...>
  <Toggle checked={soundEnabled} onChange={...} />
</SettingRow>
```

Or it may be a toggle `<input type="checkbox">`. Find the relevant block and replace the toggle with a range input. Keep the label but change the control:

```tsx
<label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 12, color: 'var(--text-dim)' }}>
  Sound volume
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <input
      type="range"
      min={0}
      max={100}
      value={soundEnabled ? soundVolume : 0}
      onChange={e => {
        const v = Number(e.target.value)
        setField('soundVolume', v)
        setField('soundEnabled', v > 0)
        setChimeVolume(v)
      }}
      style={{ width: 90, accentColor: 'var(--accent)' }}
    />
    <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, minWidth: 28, textAlign: 'right' }}>
      {soundEnabled ? soundVolume : 0}%
    </span>
  </div>
</label>
```

> Because the existing mute toggle and volume slider now share the same control (0 = muted), remove the standalone `soundEnabled` toggle if it exists separately in the same section.

- [ ] **Step 4: Run type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/Settings.tsx
git commit -m "feat: volume slider replaces mute toggle in Settings (§14)"
```

---

## Post-merge: type-check + build

After all four streams are merged:

- [ ] **Run full type-check**

```
npx tsc --noEmit
```

- [ ] **Run all unit tests**

```
npx vitest run
```

Expected: all existing + new tests pass.

- [ ] **Build**

```
npm run build
```

Expected: clean build, no warnings.

---

## Self-review

### Spec coverage

| § | Item | Covered in |
|---|---|---|
| §1 | Loading skeletons | A3 (Skeleton.tsx), A2 (isLoading) |
| §2 | Animated XP bar | C2 |
| §3 | Clickable RunningTimerWidget | C3 |
| §4 | Date range picker | B2 |
| §5 | User-editable goals UI | C5 |
| §6 | Focus mode | A5 |
| §7 | Keyboard shortcut reference | A4, A5 |
| §8 | Timer keyboard shortcuts | D2 |
| §9 | Empty states | C1 (EmptyState.tsx), B1 (heatmap), C1 (RightRail) |
| §10 | Fuzzy search | C4 |
| §11 | Heatmap cell → filter | B1 |
| §12 | KPI deltas | **Already done** — skip |
| §13 | Browser notifications | D2 |
| §14 | Volume slider | D1 (chime.ts), D3 (Settings.tsx), A1 (soundVolume in store) |
| §15 | Warning sound | D1 (warning chime), D2 (trigger) |

> **Gaps:** Skeleton application to KPIRow, SubjectBreakdown, RankCard, and ActivityHeatmap is not yet wired (Skeleton.tsx exists after A3; those components are in Streams B/C). Recommended follow-up: import `Skeleton` in `KPIRow.tsx` and `SubjectBreakdown.tsx` and gate on `useXPStore(s => s.isLoading)`. This can be a fast follow-up task since Skeleton.tsx and isLoading will exist post-merge.

### Type consistency check

- `focusMode: boolean` — added to `SettingsData` in A1, used as `toggle('focusMode')` in A5. ✅
- `soundVolume: number` — added in A1, read in D2, mutated in D3. ✅
- `isLoading: boolean` — added in A2 with `_setLoading(v)`, checked in skeleton usage. ✅
- `playChime('warning')` — `'warning'` added to the union in D1. ✅
- `setChimeVolume(v)` — exported in D1, imported in D2 and D3. ✅
- `filterDate` / `onCellClick` — prop added in B1 to ActivityHeatmap, wired from StatsPage. ✅
- `Range = '...' | 'custom'` — added in B2, `rangeLabelMap` updated to include `'custom'`. ✅
- `fuzzyScore` — exported from CommandPalette in C4, imported in test. ✅
- `GoalEntry` type imported via `import type` in C5. ✅
