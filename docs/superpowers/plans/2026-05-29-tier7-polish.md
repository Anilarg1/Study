# Tier 7 Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship six self-contained UX improvements: auto-start next phase, daily session goal display, session timeline on /stats, rank-up modal ceremony, XP history chart, and a consistency score KPI.

**Architecture:** Each task touches a non-overlapping set of files. Tasks 1–2 share `useSettingsStore` and `PomodoroTimer` but in different sections; batch them if running inline. Tasks 3–6 are fully independent and can run in parallel.

**Tech Stack:** React 18, Zustand 5, TypeScript 6, Vite 6, Vitest 4, SVG (no chart library)

---

## Pre-flight

```bash
npm test
```

Expected: all tests pass. Fix failures before starting.

---

## File Map

| Task | Files touched |
|---|---|
| 1 — Auto-start | `useSettingsStore.ts`, `PomodoroTimer.tsx`, `Settings.tsx` |
| 2 — Daily goal | `useSettingsStore.ts`, `PomodoroTimer.tsx`, `Settings.tsx` |
| 3 — Session timeline | `SessionTimeline.tsx` (new), `StatsPage.tsx` |
| 4 — Rank-up modal | `RankUpToast.tsx` |
| 5 — XP history chart | `StatsPage.tsx` |
| 6 — Consistency score | `utils/stats.ts`, `tests/stats.test.ts`, `StatsPage.tsx` |

Tasks 1 and 2 both touch `useSettingsStore.ts`, `PomodoroTimer.tsx`, and `Settings.tsx` — complete them in sequence. All others are independent.

---

## Task 1: Auto-Start Next Phase

**Files:**
- Modify: `src/store/useSettingsStore.ts`
- Modify: `src/components/PomodoroTimer.tsx`
- Modify: `src/components/Settings.tsx`

### Why

After each session the timer stops and waits for a click. Users in flow don't want to switch back just to start a break.

- [ ] **Step 1: Add fields to `SettingsData` in `src/store/useSettingsStore.ts`**

In the `SettingsData` interface (around line 49), add after `soundVolume`:

```ts
autoStartBreaks:  boolean
autoStartFocus:   boolean
dailySessionGoal: number
```

In the `create` call defaults block (around line 130), add after `soundVolume: 80`:

```ts
autoStartBreaks:  false,
autoStartFocus:   false,
dailySessionGoal: 4,
```

In the `partialize` function at the bottom, add the three new fields to the returned object:

```ts
autoStartBreaks:  state.autoStartBreaks,
autoStartFocus:   state.autoStartFocus,
dailySessionGoal: state.dailySessionGoal,
```

`autoStartBreaks` and `autoStartFocus` are **not** device-local — they should sync to Supabase. Do NOT add them to `LOCAL_ONLY_KEYS`.

`dailySessionGoal` is also not local — leave it out of `LOCAL_ONLY_KEYS` too.

- [ ] **Step 2: Wire auto-start in `src/components/PomodoroTimer.tsx`**

At the top of `PomodoroTimer`, add these selector reads alongside the existing `soundEnabled` / `desktopAlerts` reads:

```ts
const autoStartBreaks  = useSettingsStore(s => s.autoStartBreaks)
const autoStartFocus   = useSettingsStore(s => s.autoStartFocus)
```

In the `handleTick` callback (around line 318), after the `if (result.rankUp)` block and before the closing brace, add:

```ts
// Auto-start next phase
const nextMode = useTimerStore.getState().mode   // already advanced by _advance()
if (autoStartBreaks && (nextMode === 'shortBreak' || nextMode === 'longBreak')) {
  start()
} else if (autoStartFocus && nextMode === 'work') {
  start()
}
```

Add `autoStartBreaks` and `autoStartFocus` to the `handleTick` `useCallback` dependency array:

```ts
}, [tick, awardXP, mode, subjectId, tagId, customDurations, soundEnabled, desktopAlerts,
    remaining, running, autoStartBreaks, autoStartFocus, start])
```

- [ ] **Step 3: Add auto-start toggles to `src/components/Settings.tsx`**

Find the timer settings section (search for `soundVolume` — it's in the sound section). Add a new group for timer behaviour. Search for the `Row` component that renders the sound volume slider, and add below it a new section:

```tsx
<Group title="Timer Behaviour">
  <Row
    label="Auto-start breaks"
    description="Automatically begin break after a focus session ends"
  >
    <Toggle
      checked={s.autoStartBreaks}
      onChange={v => s.setField('autoStartBreaks', v)}
    />
  </Row>
  <Row
    label="Auto-start focus"
    description="Automatically begin focus after a break ends"
  >
    <Toggle
      checked={s.autoStartFocus}
      onChange={v => s.setField('autoStartFocus', v)}
    />
  </Row>
</Group>
```

To find where `Group` and `Row` are defined, search for `function Group` and `function Row` at the top of `Settings.tsx` — they are local components. Use the same patterns already in that file.

- [ ] **Step 4: Build and manual test**

```bash
npm run build
```

Expected: no TypeScript errors.

Manual test:
1. `npm run dev`, open Settings → find the new "Timer Behaviour" group
2. Enable "Auto-start breaks"
3. Go to timer → start a session → when it ends, the break timer should start automatically
4. Disable the toggle — confirm it no longer auto-starts

- [ ] **Step 5: Commit**

```bash
git add src/store/useSettingsStore.ts src/components/PomodoroTimer.tsx src/components/Settings.tsx
git commit -m "feat(timer): auto-start next phase via settings toggles"
```

---

## Task 2: Daily Session Goal Display

**Files:**
- Modify: `src/store/useSettingsStore.ts` *(already modified in Task 1 — `dailySessionGoal` is already added)*
- Modify: `src/components/PomodoroTimer.tsx`
- Modify: `src/components/Settings.tsx`

### Why

Users set a daily target (e.g. 6 sessions) but have no visual progress indicator in the timer view.

- [ ] **Step 1: Add selector reads in `PomodoroTimer.tsx`**

Below the auto-start selectors added in Task 1, add:

```ts
const dailySessionGoal = useSettingsStore(s => s.dailySessionGoal)
const sessions         = useXPStore(s => s.sessions)
```

Add `useXPStore` import at the top if not already imported (check the existing imports — it likely is).

- [ ] **Step 2: Compute `completedToday` in `PomodoroTimer.tsx`**

Below the existing `const pips = getPips(completedWork)` line (around line 408), add:

```ts
const completedToday = useMemo(() => {
  const today = toLocalDateStr()
  return sessions.filter(s => s.type === 'work' && dateOf(s.completedAt) === today).length
}, [sessions])
```

Add `useMemo` to the React import if missing. Add `toLocalDateStr, dateOf` to the import from `'../utils/date'` if missing.

- [ ] **Step 3: Render daily goal below the pips row in `PomodoroTimer.tsx`**

Find the `{/* pips */}` section (around line 705). After the closing `</div>` of `.pips-row`, add:

```tsx
{dailySessionGoal > 0 && (
  <div style={{
    fontSize: 10,
    color: 'var(--text-faint)',
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: '0.03em',
  }}>
    <b style={{ color: completedToday >= dailySessionGoal ? 'var(--focus)' : 'var(--text-dim)' }}>
      {completedToday}
    </b>
    {' / '}{dailySessionGoal} today
  </div>
)}
```

When `completedToday >= dailySessionGoal` the count turns `--focus` colored (purple) as a subtle completion signal.

- [ ] **Step 4: Add the daily goal number input to Settings.tsx**

In the "Timer Behaviour" group added in Task 1, add a third row:

```tsx
<Row
  label="Daily session goal"
  description="Show progress toward this many sessions per day (0 = off)"
>
  <input
    type="number"
    min={0}
    max={20}
    value={s.dailySessionGoal}
    onChange={e => s.setField('dailySessionGoal', Math.max(0, Math.min(20, Number(e.target.value))))}
    style={{
      width: 52,
      background: 'var(--surface-3)',
      border: '1px solid var(--hairline-2)',
      borderRadius: 5,
      color: 'var(--text)',
      fontSize: 12,
      padding: '3px 6px',
      textAlign: 'center',
      fontFamily: 'inherit',
    }}
  />
</Row>
```

- [ ] **Step 5: Build and manual test**

```bash
npm run build
```

Manual test:
1. Set daily goal to 2 in Settings
2. Complete a session — counter below pips should show "1 / 2 today"
3. Set goal to 0 — counter disappears

- [ ] **Step 6: Commit**

```bash
git add src/components/PomodoroTimer.tsx src/components/Settings.tsx
git commit -m "feat(timer): daily session goal counter below pips"
```

---

## Task 3: Session Timeline on /stats

**Files:**
- Create: `src/components/stats/SessionTimeline.tsx`
- Modify: `src/pages/StatsPage.tsx`

### Why

The stats page shows aggregates only. A session-by-session log makes it easy to review what was actually studied.

- [ ] **Step 1: Create `src/components/stats/SessionTimeline.tsx`**

```tsx
import { useState } from 'react'
import type { SessionEntry } from '../../types'
import type { Subject } from '../../types'
import { dateOf, fmtMins, sessionMins } from '../../utils/date'
import EmptyState from '../EmptyState'

interface SessionTimelineProps {
  sessions: SessionEntry[]
  subjects: Subject[]
}

const PAGE_SIZE = 50

export function SessionTimeline({ sessions, subjects }: SessionTimelineProps) {
  const [page, setPage] = useState(1)

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  )

  const visible = sorted.slice(0, page * PAGE_SIZE)
  const hasMore = sorted.length > visible.length

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
          </svg>
        }
        title="No sessions in this range"
        subtitle="Try a wider range or clear filters"
      />
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {visible.map(s => {
          const subj     = subjects.find(x => x.id === s.subjectId)
          const d        = new Date(s.completedAt)
          const dateStr  = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          const timeStr  = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
          const mins     = sessionMins(s)

          return (
            <div
              key={s.id}
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        10,
                padding:    '7px 0',
                borderBottom: '1px solid var(--hairline)',
                fontSize:   12,
              }}
            >
              {/* date + time */}
              <span style={{ color: 'var(--text-faint)', fontFamily: "'Geist Mono',monospace", fontSize: 10.5, minWidth: 92 }}>
                {dateStr}, {timeStr}
              </span>

              {/* subject dot + name */}
              {subj ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: subj.color, flexShrink: 0 }} />
                  <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {subj.name}
                  </span>
                </span>
              ) : (
                <span style={{ flex: 1, color: 'var(--text-mute)' }}>—</span>
              )}

              {/* duration */}
              <span style={{ color: 'var(--text-dim)', fontFamily: "'Geist Mono',monospace", fontSize: 10.5, minWidth: 40, textAlign: 'right' }}>
                {mins > 0 ? fmtMins(mins) : '—'}
              </span>

              {/* XP */}
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--focus)',
                background: 'color-mix(in srgb, var(--focus) 12%, transparent)',
                borderRadius: 4,
                padding: '1px 6px',
                minWidth: 44,
                textAlign: 'center',
                flexShrink: 0,
              }}>
                +{s.xp} XP
              </span>
            </div>
          )
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setPage(p => p + 1)}
          style={{
            marginTop:  12,
            fontSize:   11,
            color:      'var(--text-mute)',
            background: 'none',
            border:     '1px solid var(--hairline)',
            borderRadius: 6,
            padding:    '5px 14px',
            cursor:     'pointer',
            display:    'block',
            marginInline: 'auto',
          }}
        >
          Show more ({sorted.length - visible.length} remaining)
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add SessionTimeline to `src/pages/StatsPage.tsx`**

Add the import near the top with the other stats component imports:

```ts
import { SessionTimeline } from '../components/stats/SessionTimeline'
```

Find the closing `</div>{/* /s-scroll */}` (last line before `</div>` at the bottom of the component, around line 813). Insert the new section just before it:

```tsx
{/* ── SESSION LOG ── */}
<section className="sc" style={{ marginTop: 12 }}>
  <div className="sc-head">
    <span className="sc-label">
      <svg className="ic" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
      </svg>
      Session log
    </span>
    <span className="sc-meta">{workSessions.length} sessions</span>
  </div>
  <SessionTimeline sessions={workSessions} subjects={subjects} />
</section>
```

`workSessions` and `subjects` are already in scope from the existing `StatsPage` state.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: no errors. Open `/stats` in the browser — a new "Session log" section appears at the bottom showing your work sessions in descending order.

- [ ] **Step 4: Commit**

```bash
git add src/components/stats/SessionTimeline.tsx src/pages/StatsPage.tsx
git commit -m "feat(stats): add scrollable session timeline at bottom of stats page"
```

---

## Task 4: Rank-Up Modal Ceremony

**Files:**
- Modify: `src/components/RankUpToast.tsx`

### Why

A full tier promotion (e.g. Wanderer → Scholar) deserves a proper moment, not just a corner toast.

- [ ] **Step 1: Replace `src/components/RankUpToast.tsx` entirely**

```tsx
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import RankBadge from './RankBadge'
import type { RankInfo } from '../utils/progression'
import { playChime } from '../lib/chime'

export interface RankUpEvent {
  previous: RankInfo
  current:  RankInfo
  key:      number
}

interface RankUpToastProps {
  event: RankUpEvent | null
}

// ── Full-screen modal (tier promotion only) ────────────────────────────────

function RankUpModal({ event, onClose }: { event: RankUpEvent; onClose: () => void }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Defer animation so the initial paint shows the pre-animation state
    const t = setTimeout(() => setReady(true), 30)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position:   'fixed',
        inset:      0,
        zIndex:     10000,
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        opacity:    ready ? 1 : 0,
        transition: 'opacity 250ms ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:          420,
          maxWidth:       'calc(100vw - 32px)',
          background:     'var(--surface-2)',
          border:         `1px solid ${event.current.color}55`,
          borderRadius:   20,
          padding:        '40px 32px 32px',
          textAlign:      'center',
          boxShadow:      `0 20px 60px ${event.current.color}22, 0 4px 24px rgba(0,0,0,0.4)`,
          transform:      ready ? 'scale(1)' : 'scale(0.88)',
          transition:     'transform 400ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Label */}
        <div style={{
          fontSize:       10,
          fontWeight:     700,
          letterSpacing:  '0.12em',
          textTransform:  'uppercase',
          color:          event.current.color,
          marginBottom:   20,
        }}>
          Rank up
        </div>

        {/* Badge */}
        <div style={{
          display:        'flex',
          justifyContent: 'center',
          marginBottom:   20,
          transform:      ready ? 'scale(1)' : 'scale(0.5)',
          transition:     'transform 500ms cubic-bezier(0.34,1.56,0.64,1) 60ms',
        }}>
          <RankBadge
            tierIndex={event.current.tierIndex}
            size={96}
            subLevel={event.current.subLevel}
            showPips={true}
          />
        </div>

        {/* Rank name */}
        <div style={{
          fontSize:   28,
          fontWeight: 800,
          color:      event.current.color,
          marginBottom: 6,
          lineHeight:   1.1,
        }}>
          {event.current.label}
        </div>

        {/* Previous → new */}
        <div style={{
          fontSize:     12,
          color:        'var(--text-mute)',
          marginBottom: 28,
        }}>
          {event.previous.label} → {event.current.label}
        </div>

        {/* Dismiss */}
        <button
          onClick={onClose}
          style={{
            fontSize:     13,
            fontWeight:   600,
            color:        event.current.color,
            background:   `color-mix(in srgb, ${event.current.color} 14%, transparent)`,
            border:       `1px solid ${event.current.color}55`,
            borderRadius: 8,
            padding:      '8px 28px',
            cursor:       'pointer',
            fontFamily:   'inherit',
          }}
        >
          Continue
        </button>
      </div>
    </div>,
    document.body,
  )
}

// ── Small toast (sub-rank up only) ────────────────────────────────────────

function RankUpToastInner({ event, visible }: { event: RankUpEvent; visible: boolean }) {
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
        border:     `1px solid ${event.current.color}44`,
        borderRadius: 10,
        padding:    '8px 14px',
        boxShadow:  `0 4px 24px ${event.current.color}22`,
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
          tierIndex={event.current.tierIndex}
          size={28}
          subLevel={event.current.subLevel}
          showPips={true}
        />
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-mute)', marginBottom: 2 }}>Rank up</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: event.current.color }}>
          {event.current.label}
        </div>
      </div>
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────────

export default function RankUpToast({ event }: RankUpToastProps) {
  const [visible,    setVisible]    = useState(false)
  const [current,    setCurrent]    = useState<RankUpEvent | null>(null)
  const [showModal,  setShowModal]  = useState(false)
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!event) return
    setCurrent(event)
    const isTierUp = event.current.tierIndex > event.previous.tierIndex

    if (isTierUp) {
      if (event.current.tierIndex > event.previous.tierIndex) {
        playChime('work')
      }
      setShowModal(true)
    } else {
      setVisible(true)
      if (dismissRef.current) clearTimeout(dismissRef.current)
      dismissRef.current = setTimeout(() => setVisible(false), 4000)
    }
  }, [event?.key])   // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null

  const isTierUp = current.current.tierIndex > current.previous.tierIndex

  return (
    <>
      {isTierUp && showModal && (
        <RankUpModal event={current} onClose={() => setShowModal(false)} />
      )}
      {!isTierUp && (
        <RankUpToastInner event={current} visible={visible} />
      )}
    </>
  )
}
```

- [ ] **Step 2: Build and test**

```bash
npm run build
```

Expected: no TypeScript errors.

Manual test: trigger a rank-up by temporarily setting `totalXP` in the XP store to just below a tier threshold, completing a session, then resetting. The modal should appear with a backdrop and animate in. Press `Esc` or click "Continue" to dismiss.

- [ ] **Step 3: Commit**

```bash
git add src/components/RankUpToast.tsx
git commit -m "feat(progression): upgrade tier promotion to full-screen modal ceremony"
```

---

## Task 5: XP History Chart

**Files:**
- Modify: `src/pages/StatsPage.tsx`

### Why

The progression card shows current rank and subjects but no sense of growth over time.

- [ ] **Step 1: Add XP history derivation to `StatsPage.tsx`**

In the `ProgressionCard` component (around line 55, which reads `sessions` from `useXPStore`), add a `useMemo` below the existing ones:

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
      last.xp = running
    } else {
      points.push({ date: ds, xp: running })
    }
  }
  return points.slice(-30)
}, [sessions])
```

Add `dateOf` to the `ProgressionCard`'s import from `'../utils/date'` (it's already imported in the outer `StatsPage` but `ProgressionCard` is a separate memo — verify its local imports).

- [ ] **Step 2: Render the SVG polyline in `ProgressionCard`**

After the rank progress bar `<div>` (around line 98, the 3px height bar), add:

```tsx
{xpHistory.length >= 2 && (
  <div style={{ marginBottom: 20 }}>
    <div style={{ fontSize: 10, color: 'var(--text-faint)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 6 }}>
      XP over time
    </div>
    <svg
      viewBox={`0 0 ${xpHistory.length - 1} 48`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: 48, display: 'block', overflow: 'visible' }}
    >
      {(() => {
        const maxXP = xpHistory[xpHistory.length - 1]?.xp ?? 1
        const minXP = xpHistory[0]?.xp ?? 0
        const range = Math.max(1, maxXP - minXP)
        const n     = xpHistory.length - 1

        const pts = xpHistory.map((p, i) => ({
          x: i,
          y: 48 - ((p.xp - minXP) / range) * 44,
        }))

        const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')

        const fillPath = [
          `M${pts[0]!.x},48`,
          ...pts.map(p => `L${p.x},${p.y}`),
          `L${n},48`,
          'Z',
        ].join(' ')

        return (
          <>
            <path d={fillPath} fill="var(--focus)" opacity={0.15} />
            <polyline
              points={polyline}
              fill="none"
              stroke="var(--focus)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )
      })()}
    </svg>
  </div>
)}
```

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: no errors. Open `/stats` → scroll to the Progression card → an XP history line chart should appear below the rank progress bar if you have at least 2 days of sessions.

- [ ] **Step 4: Commit**

```bash
git add src/pages/StatsPage.tsx
git commit -m "feat(stats): add XP history line chart to Progression card"
```

---

## Task 6: Consistency Score KPI

**Files:**
- Modify: `src/utils/stats.ts`
- Modify: `src/tests/stats.test.ts`
- Modify: `src/pages/StatsPage.tsx`

### Why

Total minutes is a volume metric; consistency score captures regularity — how many distinct days had sessions vs how many days were in the range.

- [ ] **Step 1: Add `calcConsistency` to `src/utils/stats.ts`**

Append after `calcSessionHistogram`:

```ts
// ── calcConsistency ───────────────────────────────────────────────────────────

export interface ConsistencyResult {
  score:      number   // 0–100
  activeDays: number
  rangeDays:  number
}

/**
 * Consistency = (distinct study days / range days) × 100, clamped 0–100.
 * Both dates are inclusive. For "all time" pass the date of the first session as rangeStart.
 */
export function calcConsistency(
  workSessions: SessionEntry[],
  rangeStart:   Date,
  rangeEnd:     Date,
): ConsistencyResult {
  const rangeDays  = Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000) + 1)
  const activeDays = new Set(workSessions.map(s => dateOf(s.completedAt))).size
  const score      = Math.min(100, Math.round((activeDays / rangeDays) * 100))
  return { score, activeDays, rangeDays }
}
```

- [ ] **Step 2: Add tests in `src/tests/stats.test.ts`**

Append after the existing `calcSessionHistogram` describe block:

```ts
describe('calcConsistency', () => {
  function makeWorkSession(completedAt: string): SessionEntry {
    return {
      id: 'id',
      type: 'work',
      completedAt,
      xp: 25,
      subjectId: null,
      tagId: null,
      durationSecs: 1500,
    }
  }

  it('returns 0 when no sessions', () => {
    const r = calcConsistency([], new Date('2026-05-01'), new Date('2026-05-07'))
    expect(r.score).toBe(0)
    expect(r.activeDays).toBe(0)
    expect(r.rangeDays).toBe(7)
  })

  it('returns 100 when every day has a session', () => {
    const sessions = [
      makeWorkSession('2026-05-01T10:00:00Z'),
      makeWorkSession('2026-05-02T10:00:00Z'),
      makeWorkSession('2026-05-03T10:00:00Z'),
    ]
    const r = calcConsistency(sessions, new Date('2026-05-01'), new Date('2026-05-03'))
    expect(r.score).toBe(100)
    expect(r.activeDays).toBe(3)
    expect(r.rangeDays).toBe(3)
  })

  it('deduplicates multiple sessions on the same day', () => {
    const sessions = [
      makeWorkSession('2026-05-01T09:00:00Z'),
      makeWorkSession('2026-05-01T14:00:00Z'),  // same day
    ]
    const r = calcConsistency(sessions, new Date('2026-05-01'), new Date('2026-05-07'))
    expect(r.activeDays).toBe(1)
    expect(r.score).toBe(Math.round(1 / 7 * 100))
  })

  it('clamps score to 100', () => {
    // 3 sessions on 3 days, 2-day range → would be 150% without clamp
    const sessions = [
      makeWorkSession('2026-05-01T10:00:00Z'),
      makeWorkSession('2026-05-02T10:00:00Z'),
      makeWorkSession('2026-05-03T10:00:00Z'),
    ]
    const r = calcConsistency(sessions, new Date('2026-05-02'), new Date('2026-05-03'))
    expect(r.score).toBe(100)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all tests pass including the new `calcConsistency` suite.

- [ ] **Step 4: Add the Consistency KPI card to `StatsPage.tsx`**

Add to the imports at the top of `StatsPage.tsx`:

```ts
import { bestWeek, calcPeakHour, calcSubjectMins, calcKPIs, calcSessionHistogram,
         calcConsistency, type HistBucket, type ConsistencyResult } from '../utils/stats'
```

Below the `histStats` useMemo (around line 428), add:

```ts
const consistency = useMemo<ConsistencyResult>(() => {
  const end   = new Date()
  const start = deferredRange === 'all' && workSessions.length > 0
    ? new Date(
        workSessions.reduce((min, s) => Math.min(min, new Date(s.completedAt).getTime()), Date.now())
      )
    : getRangeStart(deferredRange)
  return calcConsistency(workSessions, start, end)
}, [workSessions, deferredRange])
```

In the KPI row section (search for `{/* ── KPI ROW ── */}`, around line 646), add a fifth KPI card after the last existing `.sc.s-kpi` block:

```tsx
{/* Consistency */}
<div className="sc s-kpi">
  <div className="s-kpi-label">
    <svg className="ic" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
    Consistency
  </div>
  <div className="s-kpi-value">
    {isLoading && sessions.length === 0
      ? <Skeleton width={48} height={36} />
      : <>{consistency.score}<span className="s-kpi-unit">%</span></>
    }
  </div>
  <div className="s-kpi-sub">
    {consistency.activeDays} active of {consistency.rangeDays} days
  </div>
</div>
```

- [ ] **Step 5: Build**

```bash
npm run build
```

Expected: no errors. Open `/stats` → the KPI row now has a Consistency % card.

- [ ] **Step 6: Commit**

```bash
git add src/utils/stats.ts src/tests/stats.test.ts src/pages/StatsPage.tsx
git commit -m "feat(stats): add consistency score KPI card and calcConsistency utility"
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

Expected: clean build, zero TypeScript errors.

- [ ] Final push:

```bash
git push
```

Vercel will auto-deploy. Confirm the deploy succeeds in the Vercel dashboard.

---

## File Summary

| File | Status | Change |
|---|---|---|
| `src/store/useSettingsStore.ts` | Modified | +`autoStartBreaks`, `autoStartFocus`, `dailySessionGoal` |
| `src/components/PomodoroTimer.tsx` | Modified | Auto-start logic; daily goal counter below pips |
| `src/components/Settings.tsx` | Modified | Timer Behaviour group with three new rows |
| `src/components/stats/SessionTimeline.tsx` | Created | Paginated session log component |
| `src/pages/StatsPage.tsx` | Modified | Session log section; XP history chart; Consistency KPI card |
| `src/components/RankUpToast.tsx` | Modified | Full-screen modal for tier promotions; toast for sub-rank ups |
| `src/utils/stats.ts` | Modified | +`calcConsistency`, `ConsistencyResult` |
| `src/tests/stats.test.ts` | Modified | +`calcConsistency` test suite |
