# Running Timer Rail Widget — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a compact live-timer widget at the top of the right rail whenever the timer is running or paused mid-session and the user is on any page other than `/`.

**Architecture:** A new `RunningTimerWidget` sub-component is added to `src/components/RightRail.tsx`. `RightRail` already reads location and renders on every page — it computes the visibility condition from `useTimerStore` and conditionally renders the widget above `TodayCard` in both the stats and default rail layouts. The widget owns its own `setInterval` tick loop (500 ms) because `PomodoroTimer` is unmounted when the user navigates away and its interval is cleared on unmount.

**Tech Stack:** React 19, TypeScript, Zustand (`useTimerStore` / `useSubjectStore` / `useTagStore`), React Router v7, Vitest + `@testing-library/jest-dom`

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/components/RightRail.tsx` | Modify | Add `formatMMSS`, `calcProgress` exports; add `RunningTimerWidget` component; update `RightRail` to conditionally render widget |
| `src/tests/runningTimerWidget.test.ts` | Create | Unit tests for `formatMMSS` and `calcProgress` |

---

## Task 1 — Pure helpers (TDD)

**Files:**
- Modify: `src/components/RightRail.tsx`
- Create: `src/tests/runningTimerWidget.test.ts`

- [ ] **Step 1.1 — Create the test file with failing tests**

Create `src/tests/runningTimerWidget.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatMMSS, calcProgress } from '../components/RightRail'

describe('formatMMSS', () => {
  it('formats zero as 00:00', () => {
    expect(formatMMSS(0)).toBe('00:00')
  })

  it('pads minutes and seconds to two digits', () => {
    expect(formatMMSS(90)).toBe('01:30')   // 1 min 30 sec
    expect(formatMMSS(65)).toBe('01:05')   // leading zero on seconds
  })

  it('handles a full 25-minute session', () => {
    expect(formatMMSS(1500)).toBe('25:00')
  })

  it('handles 59:59 without overflow', () => {
    expect(formatMMSS(3599)).toBe('59:59')
  })
})

describe('calcProgress', () => {
  it('returns 0 when nothing has elapsed (full remaining)', () => {
    expect(calcProgress(1500, 1500)).toBe(0)
  })

  it('returns 1 when fully elapsed (zero remaining)', () => {
    expect(calcProgress(0, 1500)).toBe(1)
  })

  it('returns 0.5 at the halfway point', () => {
    expect(calcProgress(750, 1500)).toBe(0.5)
  })

  it('returns 0 when total is 0 (guard against division by zero)', () => {
    expect(calcProgress(0, 0)).toBe(0)
  })

  it('clamps to 0 when remaining exceeds total', () => {
    // e.g. duration was changed after the timer started
    expect(calcProgress(1600, 1500)).toBe(0)
  })
})
```

- [ ] **Step 1.2 — Run tests to confirm they fail**

```
npx vitest run src/tests/runningTimerWidget.test.ts
```

Expected output: two test suites fail with `SyntaxError` or `Cannot find module` — the exports don't exist yet.

- [ ] **Step 1.3 — Add the helpers to `RightRail.tsx`**

Open `src/components/RightRail.tsx`. After the existing imports and before `function todayStr()`, add:

```ts
// ── timer widget helpers ──────────────────────────────────────────────────

export function formatMMSS(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function calcProgress(remaining: number, total: number): number {
  if (total === 0) return 0
  return Math.max(0, Math.min(1, 1 - remaining / total))
}
```

- [ ] **Step 1.4 — Run tests to confirm they pass**

```
npx vitest run src/tests/runningTimerWidget.test.ts
```

Expected output:
```
✓ src/tests/runningTimerWidget.test.ts (9)
  ✓ formatMMSS (4)
  ✓ calcProgress (5)
```

- [ ] **Step 1.5 — Commit**

```
git add src/components/RightRail.tsx src/tests/runningTimerWidget.test.ts
git commit -m "feat(rail): add formatMMSS and calcProgress helpers with tests"
```

---

## Task 2 — `RunningTimerWidget` component + integration

**Files:**
- Modify: `src/components/RightRail.tsx`

- [ ] **Step 2.1 — Update imports at the top of `RightRail.tsx`**

Replace the existing import block:

```ts
import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import useXPStore      from '../store/useXPStore'
import { dateOf, fmtMins as fmtDuration, sessionMins, toLocalDateStr } from '../utils/date'
import useSubjectStore from '../store/useSubjectStore'
import useTagStore     from '../store/useTagStore'
import type { SessionEntry } from '../types'
```

With:

```ts
import { useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import useXPStore      from '../store/useXPStore'
import useTimerStore   from '../store/useTimerStore'
import useSubjectStore from '../store/useSubjectStore'
import useTagStore     from '../store/useTagStore'
import { dateOf, fmtMins as fmtDuration, sessionMins, toLocalDateStr } from '../utils/date'
import type { SessionEntry, TimerMode } from '../types'
```

- [ ] **Step 2.2 — Add the mode-label and mode-colour constants**

Directly after the `calcProgress` helper (still before `todayStr`), add:

```ts
const MODE_LABELS: Record<TimerMode, string> = {
  work:       'Focus',
  shortBreak: 'Short Break',
  longBreak:  'Long Break',
}

const MODE_COLORS: Record<TimerMode, string> = {
  work:       '#f97316',
  shortBreak: '#22c55e',
  longBreak:  '#818cf8',
}
```

- [ ] **Step 2.3 — Add `RunningTimerWidget` component**

Add the following function after `MODE_COLORS` and before `function todayStr()`:

```tsx
function RunningTimerWidget() {
  const running         = useTimerStore(s => s.running)
  const storedRemaining = useTimerStore(s => s.remaining)   // re-renders on each tick
  const expiresAt       = useTimerStore(s => s.expiresAt)
  const mode            = useTimerStore(s => s.mode)
  const customDurations = useTimerStore(s => s.customDurations)
  const subjectId       = useTimerStore(s => s.subjectId)
  const tagId           = useTimerStore(s => s.tagId)
  const pause           = useTimerStore(s => s.pause)
  const start           = useTimerStore(s => s.start)
  const tick            = useTimerStore(s => s.tick)

  const subjects = useSubjectStore(s => s.subjects)
  const tags     = useTagStore(s => s.tags)

  const subject = subjects.find(s => s.id === subjectId) ?? null
  const tag     = tags.find(t => t.id === tagId) ?? null

  // Own tick loop — PomodoroTimer is unmounted while this widget is visible,
  // so its interval is gone. We tick every 500 ms to keep the store up to date.
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const done = tick()
      if (done) clearInterval(id)
    }, 500)
    return () => clearInterval(id)
  }, [running, tick])

  // Compute displayed remaining directly from expiresAt for wall-clock accuracy.
  // Fall back to storedRemaining when paused (expiresAt is null when paused).
  const remaining = running && expiresAt
    ? Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000))
    : storedRemaining

  const total    = customDurations[mode]
  const progress = calcProgress(remaining, total)

  return (
    <div style={{ paddingBottom: 10, marginBottom: 2 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>

        {/* ── Left column ── */}
        <div>
          {/* Pulse dot + mode label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: MODE_COLORS[mode],
              flexShrink: 0, display: 'inline-block',
            }} />
            <span style={{ fontSize: 9, color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {MODE_LABELS[mode]}
            </span>
          </div>

          {/* Subject — only during work sessions */}
          {mode === 'work' && (
            subject ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: subject.color,
                  flexShrink: 0, display: 'inline-block',
                }} />
                <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600 }}>
                  {subject.name}
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-mute)', marginBottom: 3 }}>
                Focus
              </div>
            )
          )}

          {/* Tag chip */}
          {tag && (
            <span style={{
              fontSize: 9, color: 'var(--text-mute)',
              border: '1px solid var(--hairline)', borderRadius: 3,
              padding: '0 5px', lineHeight: '15px',
              display: 'inline-block', marginBottom: 5,
            }}>
              {tag.name}
            </span>
          )}

          {/* Back link */}
          <Link
            to="/"
            style={{
              display: 'block', fontSize: 9.5,
              color: 'var(--text-faint)', textDecoration: 'none',
              marginTop: tag ? 0 : 4,
            }}
          >
            ↩ Timer
          </Link>
        </div>

        {/* ── Right column ── */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontFamily: 'Geist Mono, monospace',
            fontSize: 30, fontWeight: 800,
            color: 'var(--text)', letterSpacing: '-1.5px', lineHeight: 1,
          }}>
            {formatMMSS(remaining)}
          </div>
          <button
            onClick={running ? pause : start}
            style={{
              marginTop: 6,
              fontSize: 9.5,
              color: 'var(--accent, #6c6cff)',
              border: '1px solid color-mix(in srgb, var(--accent, #6c6cff) 30%, transparent)',
              background: 'color-mix(in srgb, var(--accent, #6c6cff) 10%, transparent)',
              borderRadius: 4,
              padding: '3px 9px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {running ? '⏸ Pause' : '▶ Resume'}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: 'var(--hairline)', borderRadius: 2, marginTop: 9, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${progress * 100}%`,
          background: 'linear-gradient(90deg, #6c6cff, #a78bfa)',
          borderRadius: 2,
          transition: 'width 0.5s linear',
        }} />
      </div>

      {/* Hairline divider before next rail section */}
      <div style={{ borderBottom: '1px solid var(--hairline)', marginTop: 10 }} />
    </div>
  )
}
```

- [ ] **Step 2.4 — Update `RightRail` to read timer state and render the widget**

Replace the entire `export default function RightRail()` with:

```tsx
export default function RightRail() {
  const location  = useLocation()
  const isStats   = location.pathname === '/stats'
  const isTimerPage = location.pathname === '/'
  const sessions  = useXPStore(s => s.sessions)

  // Widget visibility — show when timer is in progress on any non-timer page
  const running         = useTimerStore(s => s.running)
  const remaining       = useTimerStore(s => s.remaining)
  const mode            = useTimerStore(s => s.mode)
  const customDurations = useTimerStore(s => s.customDurations)
  const isInProgress    = running || remaining < customDurations[mode]
  const showWidget      = !isTimerPage && isInProgress

  // ── stats rail ────────────────────────────────────────────────────────────
  if (isStats) {
    return (
      <aside className="v2-rail">
        {showWidget && <RunningTimerWidget />}
        <TodayCard sessions={sessions} />
      </aside>
    )
  }

  // ── timer / default rail ──────────────────────────────────────────────────
  return (
    <aside className="v2-rail">
      {showWidget && <RunningTimerWidget />}
      <TodayCard sessions={sessions} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 4px 6px' }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 500 }}>Recent sessions</span>
        <Link
          to="/stats"
          style={{ fontSize: 11, color: 'var(--text-mute)', textDecoration: 'none' }}
        >
          View all →
        </Link>
      </div>
      <RecentSessions sessions={sessions} />
    </aside>
  )
}
```

- [ ] **Step 2.5 — Run the full test suite to confirm nothing is broken**

```
npx vitest run
```

Expected output — all tests pass, including the new `runningTimerWidget` suite:
```
✓ src/tests/xp.test.ts
✓ src/tests/progression.test.ts
✓ src/tests/runningTimerWidget.test.ts
```

- [ ] **Step 2.6 — Build to confirm no TypeScript errors**

```
npx tsc --noEmit
```

Expected output: no errors printed, exit code 0.

- [ ] **Step 2.7 — Manual smoke test**

Start the dev server:
```
npm run dev
```

1. Navigate to `/` (timer page). Start a timer.
2. Click a nav item to go to `/stats`. Confirm the widget appears at the top of the right rail: pulse dot, mode label, subject name, countdown ticking, progress bar filling.
3. Click **⏸ Pause**. Confirm the countdown freezes and the button becomes **▶ Resume**. Confirm the widget stays visible.
4. Click **▶ Resume**. Confirm the countdown resumes.
5. Click **↩ Timer**. Confirm you navigate back to `/` and the widget disappears.
6. Reset the timer on the timer page. Navigate away. Confirm the widget does NOT appear (timer is back at initial state).

- [ ] **Step 2.8 — Commit**

```
git add src/components/RightRail.tsx
git commit -m "feat(rail): add RunningTimerWidget — live countdown in right rail when away from timer page"
```
