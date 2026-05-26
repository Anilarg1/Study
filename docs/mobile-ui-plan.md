# Mobile UI Implementation Plan
> Breakpoint: `max-width: 900px`

## Current layout (desktop)
```
app-shell grid: 232px  1fr  336px   (rows: 44px 1fr)
areas:  brand  topbar topbar
        nav    main   rail
```
- `.brand-corner`  — top-left logo/name block
- `.v2-nav`        — left sidebar (Sidebar.tsx)
- `.v2-rail`       — right rail (RightRail.tsx)
- `.topbar`        — top bar with cmd palette + "New session" CTA

---

## Target mobile layout (< 900px)
```
app-shell grid: 1fr   (rows: 44px 1fr)
areas:  topbar
        main
```
- `brand-corner` hidden
- `v2-nav` hidden by default; appears as **slide-in drawer** when hamburger tapped
- `v2-rail` hidden (RunningTimerWidget shown as sticky banner above bottom bar)
- **Bottom tab bar** (`position: fixed; bottom: 0; height: 52px`) replaces sidebar nav

---

## Tasks

### Task A — Mobile CSS (`src/index.css` + `src/styles/pages.css`)

**In `src/index.css` — add at the bottom:**

```css
/* ─────────────────────────────────────────────────────────────────────────── */
/* MOBILE  (≤ 900px)                                                           */
/* ─────────────────────────────────────────────────────────────────────────── */
@media (max-width: 900px) {

  /* ── Shell: collapse to single column ─────────────────────────────────── */
  .app-shell {
    grid-template-rows: 44px 1fr;
    grid-template-columns: 1fr;
    grid-template-areas:
      "topbar"
      "main";
  }
  /* settings view also collapses */
  .app-shell[data-view="settings"] {
    grid-template-areas:
      "topbar"
      "main";
  }

  .brand-corner { display: none; }
  .v2-nav       { display: none; }
  .v2-rail      { display: none; }

  /* ── Sidebar as drawer ────────────────────────────────────────────────── */
  .v2-nav.mobile-open {
    display: flex;
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: min(280px, 85vw);
    z-index: 300;
    background: var(--bg);
    border-right: 1px solid var(--hairline);
    overflow-y: auto;
    animation: drawer-slide-in 220ms cubic-bezier(.2,.8,.4,1);
    /* override collapsed state on mobile */
    padding: 8px 8px 72px;
  }
  .v2-nav.mobile-open .nav-section-hd    { display: flex; }
  .v2-nav.mobile-open .nav-item          { justify-content: flex-start; padding: 5px 8px; gap: 10px; }
  .v2-nav.mobile-open .nav-item .nav-label,
  .v2-nav.mobile-open .nav-item .ni-count { display: block; }
  .v2-nav.mobile-open .nav-item .ni-icon  { width: 15px; height: 15px; flex: 0 0 15px; }
  .v2-nav.mobile-open .nav-item .subj-dot { display: inline-block; }
  .v2-nav.mobile-open .nav-toggle         { display: none; }

  @keyframes drawer-slide-in {
    from { transform: translateX(-100%); }
    to   { transform: translateX(0); }
  }

  /* ── Drawer backdrop ──────────────────────────────────────────────────── */
  .mobile-drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 299;
    backdrop-filter: blur(2px);
    animation: mobile-fade-in 180ms ease;
  }
  @keyframes mobile-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  /* ── Topbar: show hamburger, shrink cmd-palette ───────────────────────── */
  .topbar-hamburger { display: grid !important; }

  .cmd-palette {
    min-width: 0;
    flex: 1;
    max-width: 180px;
  }
  .cmd-palette .cmd-palette-text,
  .cmd-palette .cmd-palette-kbds { display: none; }

  /* ── Timer ring: scale down ───────────────────────────────────────────── */
  .timer-wrap     { width: 270px; height: 270px; }
  .time-display   { font-size: 58px; }
  .timer-subtitle { font-size: 11.5px; }
  .controls-row   { margin-top: 18px; }
  .kbd-hint-bar   { display: none; }
  .chips-row      { max-width: 90vw; }

  /* ── Bottom tab bar ───────────────────────────────────────────────────── */
  .bottom-tab-bar {
    display: flex;
    align-items: center;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 52px;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    background: var(--surface);
    border-top: 1px solid var(--hairline);
    z-index: 200;
    padding-left: 4px;
    padding-right: 4px;
  }

  .btb-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    height: 100%;
    background: transparent;
    border: none;
    color: var(--text-mute);
    cursor: pointer;
    font-family: inherit;
    transition: color 140ms;
    padding: 0;
  }
  .btb-btn.active { color: var(--accent); transition: color 700ms; }
  .btb-btn:active { opacity: 0.7; }

  .btb-label {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.01em;
  }

  .btb-fab {
    flex: 0 0 48px;
    width: 48px;
    height: 38px;
    display: grid;
    place-items: center;
    background: var(--accent);
    border: none;
    border-radius: 12px;
    color: #fff;
    cursor: pointer;
    box-shadow: 0 4px 14px -4px var(--accent-glow);
    transition: background 700ms, box-shadow 400ms, transform 100ms;
    margin: 0 6px;
    flex-shrink: 0;
  }
  .btb-fab:active { transform: scale(0.93); }

  /* ── Main content: pad bottom so content clears tab bar ──────────────── */
  .v2-main,
  .stats-page,
  .notes-page,
  .flashcards-page,
  .timetable-page,
  .past-papers-page,
  .settings-view,
  .page-placeholder {
    padding-bottom: 60px;
  }

  /* ── Timer page: don't double-pad ────────────────────────────────────── */
  .timer-stage { padding-bottom: 12px; }

  /* ── Mobile timer banner ─────────────────────────────────────────────── */
  .mobile-timer-banner {
    position: fixed;
    bottom: 52px;
    left: 0;
    right: 0;
    height: 38px;
    background: color-mix(in oklab, var(--accent) 14%, var(--surface));
    border-top: 1px solid color-mix(in oklab, var(--accent) 28%, var(--hairline));
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 10px;
    z-index: 199;
    cursor: pointer;
  }
  .mobile-timer-banner-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    flex-shrink: 0;
    animation: pulse-dot 1.6s ease-in-out infinite;
  }
  .mobile-timer-banner-time {
    font-family: 'Geist Mono', monospace;
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    letter-spacing: -0.01em;
  }
  .mobile-timer-banner-label {
    font-size: 11px;
    color: var(--text-dim);
    flex: 1;
  }
  .mobile-timer-banner-pause {
    background: transparent;
    border: 1px solid var(--hairline-2);
    border-radius: 6px;
    width: 28px;
    height: 24px;
    display: grid;
    place-items: center;
    color: var(--text-dim);
    cursor: pointer;
    font-family: inherit;
  }
}

/* ── Bottom tab bar: hidden on desktop ────────────────────────────────────── */
.bottom-tab-bar  { display: none; }
.topbar-hamburger { display: none; }
```

**In `src/styles/pages.css` — replace the empty mobile block:**

```css
@media (max-width: 900px) {
  /* Stats page: single column */
  .stats-page { padding: 16px 16px 72px; }

  /* Notes two-pane → single pane */
  .notes-page {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  /* Settings: single pane */
  .settings-view { grid-template-columns: 1fr; }
  .settings-content { padding: 20px 20px 72px; }
  .settings-sidenav {
    /* show as horizontal tab strip at top */
    flex-direction: row;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--hairline);
    padding: 8px 8px 6px;
    flex-shrink: 0;
    gap: 2px;
    height: auto;
  }
  .s-back-btn { display: none; }
  .s-nav-label { display: none; }
}
```

---

### Task B — App.tsx changes

**Add to state (after line ~42):**
```tsx
const [mobileNavOpen, setMobileNavOpen] = useState(false)
```

**Import BottomTabBar at top:**
```tsx
import BottomTabBar from './components/BottomTabBar'
```

**Add hamburger button in topbar (after the brand corner section, before `isSettings` check, first thing in topbar):**
```tsx
{/* ── HAMBURGER (mobile only) ── */}
<button
  className="icon-btn topbar-hamburger"
  onClick={() => setMobileNavOpen(true)}
  title="Menu"
  style={{ marginRight: 2 }}
>
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M3 6h18M3 12h18M3 18h18"/>
  </svg>
</button>
```

This button goes INSIDE the `<div className="topbar">` as its first child (before the isSettings conditional).

**Pass mobileOpen to Sidebar:**
```tsx
<Sidebar
  user={user}
  initials={initials}
  email={email}
  displayName={handle}
  onSignOut={signOut}
  collapsed={sidebarCollapsed}
  onToggle={() => toggleSidebar('sidebarCollapsed')}
  mobileOpen={mobileNavOpen}
  onMobileClose={() => setMobileNavOpen(false)}
/>
```

**Render BottomTabBar (after `{showRail && <RightRail />}`, before overlays):**
```tsx
{/* ── BOTTOM TAB BAR (mobile only) ── */}
<BottomTabBar
  onNewSession={handleNewSession}
  onMoreOpen={() => setMobileNavOpen(true)}
/>
```

**Mobile timer banner — after BottomTabBar:**
```tsx
{/* ── MOBILE TIMER BANNER ── */}
{showWidget && !isTimerPage && (
  <div className="mobile-timer-banner" onClick={() => navigate('/')}>
    <span className="mobile-timer-banner-dot" />
    <span className="mobile-timer-banner-time">{formatMMSS(remaining)}</span>
    <span className="mobile-timer-banner-label">{modeLabel}</span>
    <button
      className="mobile-timer-banner-pause"
      onClick={e => { e.stopPropagation(); running ? pause() : start() }}
    >
      {running ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="5" width="4" height="14" rx="1"/>
          <rect x="14" y="5" width="4" height="14" rx="1"/>
        </svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21"/>
        </svg>
      )}
    </button>
  </div>
)}
```

For this banner to work, App.tsx needs these timer store values:
```tsx
const timerRemaining    = useTimerStore(s => s.remaining)
const timerHasStarted   = useTimerStore(s => s.hasStarted)
const timerExpiresAt    = useTimerStore(s => s.expiresAt)
const pauseTimer        = useTimerStore(s => s.pause)
// startTimer already exists

const isTimerPage = location.pathname === '/'
const isInProgress = running || (timerHasStarted && timerRemaining < (customDurations ?? {})[timerMode])
const showWidget  = !isTimerPage && isInProgress
const remaining   = running && timerExpiresAt
  ? Math.max(0, Math.round((new Date(timerExpiresAt).getTime() - Date.now()) / 1000))
  : timerRemaining
```

Import `formatMMSS` from `'./components/RightRail'` (it's already exported there).

The `modeLabel` map:
```tsx
const MOBILE_MODE_LABELS: Record<string, string> = {
  work: 'Focus', shortBreak: 'Short Break', longBreak: 'Long Break',
}
const modeLabel = MOBILE_MODE_LABELS[timerMode] ?? 'Focus'
```

---

### Task C — Sidebar.tsx drawer support

**Update `SidebarProps` interface — add:**
```tsx
mobileOpen?:    boolean
onMobileClose?: () => void
```

**Update destructure:**
```tsx
export default function Sidebar({
  user: _user, initials, email, displayName, onSignOut,
  collapsed, onToggle,
  mobileOpen = false, onMobileClose,
}: SidebarProps) {
```

**Wrap the return in a fragment and add backdrop + nav class:**

Change:
```tsx
return (
  <nav className="v2-nav">
```
To:
```tsx
return (
  <>
    {mobileOpen && (
      <div
        className="mobile-drawer-backdrop"
        onClick={onMobileClose}
        aria-hidden="true"
      />
    )}
    <nav className={`v2-nav${mobileOpen ? ' mobile-open' : ''}`}>
```

And close with `</nav></>` instead of `</nav>`.

**Close drawer on nav item clicks:** Every `onClick={() => navigate('/...')}` on a nav item should also call `onMobileClose?.()`. The best way is a small helper:

```tsx
function go(path: string) {
  navigate(path)
  onMobileClose?.()
}
```

Then replace all `onClick={() => navigate('/...')}` inside the nav with `onClick={() => go('/...')}`.

Also close on sign-out:
```tsx
onSignOut={() => { onSignOut(); onMobileClose?.() }}
```

---

## File summary

| File | Change |
|------|--------|
| `src/components/BottomTabBar.tsx` | **New** — bottom tab bar component |
| `src/components/Sidebar.tsx` | Add `mobileOpen`/`onMobileClose` props, drawer class + backdrop |
| `src/App.tsx` | Add state, hamburger, BottomTabBar, mobile timer banner |
| `src/index.css` | Mobile media query block (shell, drawer, timer scaling, bottom bar) |
| `src/styles/pages.css` | Mobile page overrides (padding-bottom, stats, settings) |

## Notes
- `BottomTabBar.tsx` is already created with the correct structure
- All CSS classes (`btb-btn`, `btb-fab`, `btb-label`, `bottom-tab-bar`, `topbar-hamburger`, `mobile-drawer-backdrop`, `mobile-timer-banner`) are defined in Task A
- The mobile timer banner needs `formatMMSS` (re-exported from `RightRail.tsx`) — it's already exported there as a named export
