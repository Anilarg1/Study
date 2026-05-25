# Running Timer Rail Widget

**Date:** 2026-05-26  
**Status:** Approved

## Summary

When the user navigates away from the timer page while a session is running or paused mid-session, a compact widget appears at the top of the right rail. It shows the current countdown, mode, subject, and a pause/resume button — all without leaving the current page.

---

## Visibility Rule

The widget is shown when **both** conditions are true:

1. The user is **not** on the timer page (`location.pathname !== '/'`)
2. The timer is **in progress** — either actively running or paused mid-session:

```ts
const isInProgress = running || remaining < customDurations[mode]
```

The widget disappears automatically when:
- The user navigates back to the timer page
- A session completes naturally (`_advance()` resets `remaining` to the new mode's full duration, making `isInProgress` false)

---

## Architecture

**No new store state.** All required data already exists in `useTimerStore`, `useSubjectStore`, and `useTagStore`.

The widget is a new sub-component `RunningTimerWidget` added to `src/components/RightRail.tsx`. `RightRail` already has location-awareness and renders on every page — it's the correct host.

`RunningTimerWidget` is rendered **above** `TodayCard` in the rail, making it the first thing visible when the timer is active.

---

## Layout (Mix 3 — flush/ghost style)

Two-column layout, no card border. Separated from the rest of the rail by a hairline bottom divider and a 2px gradient progress bar.

```
┌─────────────────────────────────────────┐
│ ● Focus          │                23:41 │
│ Maths            │           ⏸ Pause  │
│ [Calculus]       │                      │
│ ↩ Timer          │                      │
│▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░│  ← 2px progress bar
└─────────────────────────────────────────┘
```

**Left column:**
- Pulse dot + mode label (e.g. `● Focus`, `● Short Break`)
- Subject colour dot + subject name (bold, ~12px)
- Tag chip (if a tag is set; omitted if not)
- `↩ Timer` back-link (navigates to `/`)

**Right column (right-aligned):**
- Large monospace countdown (`font-size: 30px`, `font-weight: 800`)
- Accent-tinted pause/resume button

**Bottom:**
- 2px gradient progress bar (`#6c6cff → #a78bfa`), width = `(1 - remaining / customDurations[mode]) * 100%`
- Hairline divider (`border-bottom: 1px solid #1f1f1f`) below the bar, before the next rail section

---

## Component Structure

```
RightRail
  └── RunningTimerWidget   ← new, rendered when isInProgress && !isTimerPage
  └── TodayCard
  └── RecentSessions       ← only on non-stats pages
```

`RunningTimerWidget` reads:

| Data | Source |
|---|---|
| `running`, `expiresAt`, `mode`, `customDurations` | `useTimerStore` |
| `remaining` | computed locally from `expiresAt` each render tick (see below) |
| `pause()`, `start()`, `tick()` | `useTimerStore` |
| `subjectId`, `tagId` | `useTimerStore` |
| Subject name + colour | `useSubjectStore` → find by `subjectId` |
| Tag name | `useTagStore` → find by `tagId` |

### Tick loop ownership

`PomodoroTimer`'s `setInterval` is **cleared on unmount** — when the user navigates away, the store's `remaining` field stops updating. `RunningTimerWidget` must own its own tick loop while visible:

```ts
useEffect(() => {
  if (!running) return
  const id = setInterval(() => {
    const done = tick()          // updates store.remaining, calls _advance() if expired
    if (done) clearInterval(id)
  }, 500)
  return () => clearInterval(id)
}, [running])
```

`PomodoroTimer` and `RunningTimerWidget` are **mutually exclusive** (widget only renders when not on the timer page), so there is no double-tick risk.

**Displayed time** is derived from `expiresAt` directly (`_calcRemaining()`) rather than reading the store's `remaining` field, so it is always wall-clock accurate regardless of tick cadence.

Progress fraction: `1 - _calcRemaining() / customDurations[mode]`  
Formatted time: local `formatMMSS(seconds: number)` helper — pads minutes and seconds to two digits.

---

## Behaviour

### Pause / Resume
- Clicking **⏸ Pause** calls `useTimerStore.pause()` — widget stays visible, countdown freezes, button becomes **▶ Resume**
- Clicking **▶ Resume** calls `useTimerStore.start()` — countdown resumes, button becomes **⏸ Pause**
- No navigation on either action

### Back link
- `↩ Timer` is a React Router `<Link to="/">` — navigates to the timer page
- On arrival, `isTimerPage` becomes true and the widget unmounts

---

## Edge Cases

| Case | Behaviour |
|---|---|
| No subject selected | Left column shows `Focus` in muted text (`var(--text-mute)`) instead of subject name; no colour dot |
| No tag set | Tag chip is omitted entirely |
| Session completes while on another page | `RunningTimerWidget`'s own tick loop calls `tick()` → `_advance()` fires → mode resets → `isInProgress` goes false → widget disappears. **Known limitation:** XP award and session save only happen in `PomodoroTimer`'s completion handler, which is unmounted — so a session that ends away from the timer page does not earn XP or persist to history. This is out of scope for this feature. |
| Short break / long break running | Mode label and pulse dot update to reflect the current mode; subject row is hidden (breaks have no subject) |

---

## Files Changed

| File | Change |
|---|---|
| `src/components/RightRail.tsx` | Add `RunningTimerWidget` sub-component; render it conditionally above `TodayCard` |

No other files need to change.

---

## Known Limitations

- **XP / session save on away-completion:** If a work session ends while the user is on another page, `_advance()` fires (mode cycles) but XP is not awarded and the session is not saved to history. The completion effects live in `PomodoroTimer` and are out of scope here. Users who care about XP should return to the timer page before the session ends, or this can be addressed in a follow-up by lifting the completion handler to a global level.
