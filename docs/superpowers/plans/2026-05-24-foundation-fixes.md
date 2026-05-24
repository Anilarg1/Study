# Foundation Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the six structural gaps (dead code, missing error boundary, duplicated TagPicker logic, no routing, missing `fetchSessions`, dead RightRail tabs) that would compound in cost with every subsequent feature added.

**Architecture:** The routing refactor is the spine — everything hangs off it. Tasks 1–3 are independent and order-free. Task 4 (routing) must finish before Task 6 (RightRail Link). Task 5 (`fetchSessions`) must finish before the All-time tab in Task 6 can be fully accurate. All tasks are self-contained, buildable, and manually verifiable.

**Tech Stack:** React 18, TypeScript (strict), Vite, Zustand 5, Supabase JS v2, `react-router-dom` v6 (to be installed in Task 4). No test framework is present; `npm run build` (TypeScript compile + bundle) is used as the regression check after every task. Manual browser verification steps are included.

---

## File Map

| File | Status | Task |
|---|---|---|
| `ss.mjs` | **Delete** | 1 |
| `design-v2/` | **Delete** | 1 |
| `src/components/ErrorBoundary.tsx` | **Create** | 2 |
| `src/main.tsx` | Modify | 2, 4 |
| `src/components/TagPicker.tsx` | **Create** | 3 |
| `src/components/NewSessionModal.tsx` | Modify | 3 |
| `src/components/PomodoroTimer.tsx` | Modify | 3 |
| `src/pages/TimerPage.tsx` | **Create** | 4 |
| `src/pages/SettingsPage.tsx` | **Create** | 4 |
| `src/pages/StatsPage.tsx` | **Create** | 4 |
| `src/pages/NotesPage.tsx` | **Create** | 4 |
| `src/pages/FlashcardsPage.tsx` | **Create** | 4 |
| `src/pages/TimetablePage.tsx` | **Create** | 4 |
| `src/pages/PastPapersPage.tsx` | **Create** | 4 |
| `src/App.tsx` | Modify | 4 |
| `src/components/Sidebar.tsx` | Modify | 4 |
| `src/components/CommandPalette.tsx` | Modify | 4 |
| `src/components/Settings.tsx` | Modify | 4 |
| `src/lib/supabase.ts` | Modify | 5 |
| `src/store/useXPStore.ts` | Modify | 5 |
| `src/store/useAuthStore.ts` | Modify | 5 |
| `src/components/RightRail.tsx` | Modify | 6 |
| `src/styles/pages.css` | **Create** | 7 |
| `src/index.css` | Modify (1 line) | 7 |

---

## Task 1: Delete dead code

**Files:**
- Delete: `ss.mjs`
- Delete: `design-v2/` (entire directory)

- [ ] **Step 1: Delete the files**

```bash
rm ss.mjs
rm -rf design-v2/
```

- [ ] **Step 2: Verify the build still passes**

```bash
npm run build
```

Expected: no errors, `dist/` produced.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove stale ss.mjs and design-v2 artefacts"
```

---

## Task 2: Error Boundary

**Files:**
- Create: `src/components/ErrorBoundary.tsx`
- Modify: `src/main.tsx`

React error boundaries must be class components; you cannot write them as functions.

- [ ] **Step 1: Create `src/components/ErrorBoundary.tsx`**

```tsx
import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props  { children: ReactNode }
interface State  { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          background: 'var(--bg, #0e0e10)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
        }}>
          <span style={{ fontSize: 28 }}>⚠️</span>
          <p style={{ fontSize: 14, color: 'var(--text, #e4e4e7)', fontWeight: 500, margin: 0 }}>
            Something went wrong
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-mute, #71717a)', margin: 0, maxWidth: 360, textAlign: 'center' }}>
            {this.state.error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: '6px 16px',
              background: 'var(--accent, #8b85ff)',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Reload app
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

- [ ] **Step 2: Update `src/main.tsx` to wrap the app**

Replace the entire file with:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { bootSettings } from './store/useSettingsStore'

// Apply stored theme/density/contrast before first paint (avoids flash)
bootSettings()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ErrorBoundary.tsx src/main.tsx
git commit -m "feat: add ErrorBoundary to prevent full blank-screen crashes"
```

---

## Task 3: Extract shared `<TagPicker>` / `useTagPicker`

The add-tag form logic (state, validation, store call, Escape handling) is copy-pasted in both `NewSessionModal.tsx` and `PomodoroTimer.tsx`. This task extracts it into one place.

**Files:**
- Create: `src/components/TagPicker.tsx`
- Modify: `src/components/NewSessionModal.tsx`
- Modify: `src/components/PomodoroTimer.tsx`

### 3a — Create `src/components/TagPicker.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useState, useRef, useEffect } from 'react'
import useTagStore from '../store/useTagStore'

// ── AddTagForm ────────────────────────────────────────────────────────────────
// Renders the inline add-tag input + button + error message.
// Escape in the input calls onDismiss (stopPropagation prevents the modal's
// own Escape listener from also firing).

interface AddTagFormProps {
  value:     string
  onChange:  (name: string) => void
  onSubmit:  () => void
  onDismiss: () => void
  error:     string | null
}

export function AddTagForm({ value, onChange, onSubmit, onDismiss, error }: AddTagFormProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter')  { e.preventDefault(); onSubmit() }
            if (e.key === 'Escape') { e.stopPropagation(); onDismiss() }
          }}
          placeholder="Tag name"
          maxLength={30}
          style={{
            flex: 1,
            background: 'var(--surface-3)',
            border: '1px solid var(--hairline-2)',
            borderRadius: 6,
            padding: '5px 8px',
            fontSize: 12,
            color: 'var(--text)',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={onSubmit}
          style={{
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 6,
            padding: '5px 10px',
            fontSize: 12,
            color: '#fff',
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          Add
        </button>
      </div>
      {error && (
        <span style={{ fontSize: 11, color: '#f87171' }}>{error}</span>
      )}
    </div>
  )
}

// ── useTagPicker ──────────────────────────────────────────────────────────────
// Encapsulates add-tag form state. Call onTagCreated(id) when a tag is saved.

interface UseTagPickerReturn {
  newTagName:    string
  setNewTagName: (v: string) => void
  tagAddError:   string | null
  showAddTag:    boolean
  setShowAddTag: (v: boolean) => void
  handleAddTag:  () => Promise<void>
  dismissAddTag: () => void
}

export function useTagPicker(onTagCreated: (tagId: string) => void): UseTagPickerReturn {
  const addTag = useTagStore(s => s.addTag)

  const [newTagName,  setNewTagName]  = useState('')
  const [tagAddError, setTagAddError] = useState<string | null>(null)
  const [showAddTag,  setShowAddTag]  = useState(false)

  async function handleAddTag() {
    const name = newTagName.trim()
    if (!name) return
    setTagAddError(null)
    const tag = await addTag(name)
    if (tag) {
      onTagCreated(tag.id)
      setNewTagName('')
      setShowAddTag(false)
    } else {
      setTagAddError('Could not save — check your connection.')
    }
  }

  function dismissAddTag() {
    setNewTagName('')
    setTagAddError(null)
    setShowAddTag(false)
  }

  return { newTagName, setNewTagName, tagAddError, showAddTag, setShowAddTag, handleAddTag, dismissAddTag }
}
```

### 3b — Refactor `NewSessionModal.tsx`

- [ ] **Step 2: Replace the add-tag state and form JSX in `NewSessionModal.tsx`**

**At the top of the file, change the imports** from:

```tsx
import { useState, useEffect, useRef } from 'react'
import useSubjectStore from '../store/useSubjectStore'
import useTagStore     from '../store/useTagStore'
```

to:

```tsx
import { useState, useEffect } from 'react'
import useSubjectStore from '../store/useSubjectStore'
import useTagStore     from '../store/useTagStore'
import { useTagPicker, AddTagForm } from './TagPicker'
```

**In the component body, remove these four lines:**

```tsx
  const [showAddTag,  setShowAddTag]  = useState(false)
  const [newTagName,  setNewTagName]  = useState('')
  const [tagAddError, setTagAddError] = useState<string | null>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)
```

And remove the `useEffect` that focuses `tagInputRef`:

```tsx
  // Focus tag input when panel opens
  useEffect(() => {
    if (showAddTag) tagInputRef.current?.focus()
  }, [showAddTag])
```

**Add the hook call** (right after the `useState` calls for `selectedTagId`, `selectedSubjectId`, and `duration`):

```tsx
  const {
    newTagName, setNewTagName,
    tagAddError,
    showAddTag, setShowAddTag,
    handleAddTag, dismissAddTag,
  } = useTagPicker(tagId => setSelectedTagId(tagId))
```

**Remove the old `handleAddTag` function** (the async function that called `addTag`):

```tsx
  async function handleAddTag() {
    const name = newTagName.trim()
    if (!name) return
    setTagAddError(null)
    const tag = await addTag(name)
    if (tag) {
      setSelectedTagId(tag.id)
      setNewTagName('')
      setShowAddTag(false)
    } else {
      setTagAddError('Could not save — check your connection.')
    }
  }
```

**Remove the `addTag` destructure** from the `useTagStore` line:

```tsx
// Before:
const addTag   = useTagStore(s => s.addTag)

// After: remove this line entirely (addTag is now used inside useTagPicker)
```

**Find the inline add-tag form JSX** (the section with `tagInputRef`, the input, and the error span) and replace it with `<AddTagForm>`:

The existing JSX looks like:

```tsx
{showAddTag && (
  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
    <div style={{ display: 'flex', gap: 6 }}>
      <input
        ref={tagInputRef}
        type="text"
        value={newTagName}
        onChange={e => { setNewTagName(e.target.value); setTagAddError(null) }}
        onKeyDown={e => {
          if (e.key === 'Enter')  { e.preventDefault(); handleAddTag() }
          if (e.key === 'Escape') { e.stopPropagation(); setShowAddTag(false); setNewTagName(''); setTagAddError(null) }
        }}
        placeholder="Tag name"
        maxLength={30}
        style={{ ... }}
      />
      <button onClick={handleAddTag} style={{ ... }}>Add</button>
    </div>
    {tagAddError && (
      <span style={{ fontSize: 11, color: '#f87171' }}>{tagAddError}</span>
    )}
  </div>
)}
```

Replace the entire block with:

```tsx
{showAddTag && (
  <div style={{ marginTop: 8 }}>
    <AddTagForm
      value={newTagName}
      onChange={setNewTagName}
      onSubmit={handleAddTag}
      onDismiss={dismissAddTag}
      error={tagAddError}
    />
  </div>
)}
```

### 3c — Refactor `PomodoroTimer.tsx`

- [ ] **Step 3: Apply the same extraction in `PomodoroTimer.tsx`**

**Update the imports** — add `TagPicker` imports:

```tsx
import { useTagPicker, AddTagForm } from './TagPicker'
```

**Remove these state declarations** from the component body:

```tsx
  const [showAddTag,  setShowAddTag]  = useState(false)
  const [newTagName,  setNewTagName]  = useState('')
  const [tagAddError, setTagAddError] = useState<string | null>(null)
```

**Add the hook call** (near the other state declarations):

```tsx
  const {
    newTagName, setNewTagName,
    tagAddError,
    showAddTag, setShowAddTag,
    handleAddTag, dismissAddTag,
  } = useTagPicker(tagId => setTagId(tagId))
```

Note: `setTagId` here is from `useTimerStore` — it's already destructured in the component.

**Remove the old `handleAddTag` function** defined inside `PomodoroTimer` (the one that called `addTag` and set `selectedTagId`).

**Find the inline add-tag form JSX inside the tag picker popover** and replace it with `<AddTagForm>`:

```tsx
{showAddTag && (
  <div style={{ padding: '8px 10px', borderTop: '1px solid var(--hairline)' }}>
    <AddTagForm
      value={newTagName}
      onChange={setNewTagName}
      onSubmit={handleAddTag}
      onDismiss={dismissAddTag}
      error={tagAddError}
    />
  </div>
)}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: no errors. If TypeScript complains about an unused `addTag` import in either component, remove it.

- [ ] **Step 5: Manual smoke test**

Run `npm run dev`, open the app, and verify:
1. **NewSessionModal** (`C` key or "New session" button): Tags section shows existing tags. Click "+". Type a name. Press `Escape` — panel closes, modal stays open. Click "+" again, type a name, press `Enter` — tag is created and selected.
2. **PomodoroTimer tag chip**: Open tag picker. Click "+". Type a name. Press `Escape` — panel closes, dropdown stays open. Click "+", type, press `Enter` — tag created and shown on timer chip.

- [ ] **Step 6: Commit**

```bash
git add src/components/TagPicker.tsx src/components/NewSessionModal.tsx src/components/PomodoroTimer.tsx
git commit -m "refactor: extract shared useTagPicker hook and AddTagForm component"
```

---

## Task 4: Install React Router and wire routing

This is the largest task. It replaces the `view` state in `App.tsx` with `react-router-dom` v6, creates page stubs for all planned feature pages, and makes Sidebar and CommandPalette router-aware.

**Files:**
- Install: `react-router-dom`
- Create: `src/pages/TimerPage.tsx`, `SettingsPage.tsx`, `StatsPage.tsx`, `NotesPage.tsx`, `FlashcardsPage.tsx`, `TimetablePage.tsx`, `PastPapersPage.tsx`
- Modify: `src/main.tsx`, `src/App.tsx`, `src/components/Sidebar.tsx`, `src/components/CommandPalette.tsx`, `src/components/Settings.tsx`

### 4a — Install the package

- [ ] **Step 1: Install `react-router-dom`**

```bash
npm install react-router-dom
```

Expected: package added to `node_modules/`. No `npm run build` needed yet.

### 4b — Create page components

- [ ] **Step 2: Create `src/pages/TimerPage.tsx`**

```tsx
import PomodoroTimer from '../components/PomodoroTimer'

export default function TimerPage() {
  return <PomodoroTimer />
}
```

- [ ] **Step 3: Create `src/pages/SettingsPage.tsx`**

```tsx
import { useNavigate } from 'react-router-dom'
import Settings from '../components/Settings'

export default function SettingsPage() {
  const navigate = useNavigate()
  return <Settings onBack={() => navigate('/')} />
}
```

- [ ] **Step 4: Create `src/pages/StatsPage.tsx`**

```tsx
export default function StatsPage() {
  return (
    <main className="page-placeholder">
      <span>📊</span>
      <p>Stats — coming soon</p>
    </main>
  )
}
```

- [ ] **Step 5: Create `src/pages/NotesPage.tsx`**

```tsx
export default function NotesPage() {
  return (
    <main className="page-placeholder">
      <span>📝</span>
      <p>Notes — coming soon</p>
    </main>
  )
}
```

- [ ] **Step 6: Create `src/pages/FlashcardsPage.tsx`**

```tsx
export default function FlashcardsPage() {
  return (
    <main className="page-placeholder">
      <span>🃏</span>
      <p>Flashcards — coming soon</p>
    </main>
  )
}
```

- [ ] **Step 7: Create `src/pages/TimetablePage.tsx`**

```tsx
export default function TimetablePage() {
  return (
    <main className="page-placeholder">
      <span>📅</span>
      <p>Timetable — coming soon</p>
    </main>
  )
}
```

- [ ] **Step 8: Create `src/pages/PastPapersPage.tsx`**

```tsx
export default function PastPapersPage() {
  return (
    <main className="page-placeholder">
      <span>📄</span>
      <p>Past Papers — coming soon</p>
    </main>
  )
}
```

Add `.page-placeholder` styles to `src/index.css` (find a logical spot in the file):

```css
.page-placeholder {
  grid-area: main;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-faint);
  font-size: 13px;
}
.page-placeholder span { font-size: 28px; }
```

### 4c — Wrap the app in BrowserRouter

- [ ] **Step 9: Update `src/main.tsx`**

Replace the file with (note: Task 2 already added ErrorBoundary here):

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { bootSettings } from './store/useSettingsStore'

bootSettings()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
```

### 4d — Refactor `App.tsx`

- [ ] **Step 10: Replace `src/App.tsx` entirely**

```tsx
import { useEffect, useCallback, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import LoginPage       from './components/LoginPage'
import Sidebar         from './components/Sidebar'
import RightRail       from './components/RightRail'
import NewSessionModal from './components/NewSessionModal'
import CommandPalette  from './components/CommandPalette'
import TimerPage       from './pages/TimerPage'
import SettingsPage    from './pages/SettingsPage'
import StatsPage       from './pages/StatsPage'
import NotesPage       from './pages/NotesPage'
import FlashcardsPage  from './pages/FlashcardsPage'
import TimetablePage   from './pages/TimetablePage'
import PastPapersPage  from './pages/PastPapersPage'
import useAuthStore     from './store/useAuthStore'
import useTimerStore    from './store/useTimerStore'
import useSubjectStore  from './store/useSubjectStore'
import useSettingsStore from './store/useSettingsStore'

const DATA_MODE: Record<string, string> = { work: 'focus', shortBreak: 'short', longBreak: 'long' }

function TimerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M9 2h6"/>
    </svg>
  )
}
function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()

  const { user, loading, init, signOut } = useAuthStore()
  const timerMode        = useTimerStore(s => s.mode)
  const running          = useTimerStore(s => s.running)
  const startTimer       = useTimerStore(s => s.start)
  const setTimerMode     = useTimerStore(s => s.setMode)
  const setTimerDuration = useTimerStore(s => s.setDuration)
  const setTimerSubject  = useTimerStore(s => s.setSubjectId)
  const setTimerTagId    = useTimerStore(s => s.setTagId)
  const setActiveId      = useSubjectStore(s => s.setActiveId)
  const dataMode         = DATA_MODE[timerMode] ?? 'focus'

  const sidebarCollapsed = useSettingsStore(s => s.sidebarCollapsed)
  const toggleSidebar    = useSettingsStore(s => s.toggle)

  const [showNewSession, setShowNewSession] = useState(false)
  const [showCmdPalette, setShowCmdPalette] = useState(false)

  const handleNewSession = useCallback(() => {
    setShowNewSession(true)
  }, [])

  const handleStartSession = useCallback((
    subjectId: string | null,
    durationMins: number,
    tagId: string | null,
  ) => {
    setShowNewSession(false)
    setActiveId(subjectId)
    setTimerSubject(subjectId)
    setTimerTagId(tagId)
    setTimerDuration('work', durationMins)
    setTimerMode('work')
    startTimer()
    navigate('/')
  }, [setActiveId, setTimerSubject, setTimerTagId, setTimerDuration, setTimerMode, startTimer, navigate])

  useEffect(() => { init() }, [init])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowCmdPalette(p => !p)
        return
      }
      if ((e.target as HTMLElement).matches('input, textarea')) return
      if (e.key.toLowerCase() === 'c') handleNewSession()
      if (e.key === '[') toggleSidebar('sidebarCollapsed')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleNewSession, toggleSidebar])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-mute)', fontSize: '12px', letterSpacing: '0.2em' }}>
          loading…
        </span>
      </div>
    )
  }

  if (!user) return <LoginPage />

  const typedUser   = user as User
  const email       = typedUser.email ?? ''
  const emailHandle = email.split('@')[0]
  const displayName = (typedUser.user_metadata?.display_name as string | undefined) ?? ''
  const handle      = displayName || emailHandle
  const initials    = handle.slice(0, 2).toUpperCase()

  const isSettings = location.pathname === '/settings'
  const showRail   = !isSettings

  return (
    <div
      className="app-shell"
      data-mode={dataMode}
      data-view={isSettings ? 'settings' : 'timer'}
      {...(sidebarCollapsed ? { 'data-nav-collapsed': '' } : {})}
    >

      {/* ── BRAND CORNER ── */}
      <div className="brand-corner">
        <div className="brand-logo">N</div>
        <span className="brand-text" style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text)' }}>
          Notebook
          <span style={{ color: 'var(--text-dim)', fontWeight: 450, marginLeft: 6 }}>
            / {handle}
          </span>
        </span>
        <button className="icon-btn brand-chevron" style={{ marginLeft: 'auto' }} title="Switch workspace">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="m7 9 5-5 5 5M7 15l5 5 5-5"/>
          </svg>
        </button>
      </div>

      {/* ── TOPBAR ── */}
      <div className="topbar">
        {isSettings ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-dim)' }}>
            <GearIcon />
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>Settings</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-dim)' }}>
            <TimerIcon />
            <span>Practice</span>
            <span style={{ color: 'var(--text-faint)' }}>/</span>
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>Timer</span>
          </div>
        )}

        <div style={{ flex: 1 }} />

        <button className="cmd-palette" onClick={() => setShowCmdPalette(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
               style={{ color: 'var(--text-mute)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <span style={{ flex: 1, color: 'var(--text-dim)' }}>Jump to subject, session, settings…</span>
          <span style={{ display: 'flex', gap: 2 }}>
            <span className="kbd-badge">⌘</span>
            <span className="kbd-badge">K</span>
          </span>
        </button>

        <button className="icon-btn" title="Notifications">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.7 21a2 2 0 0 1-3.4 0"/>
          </svg>
        </button>

        <button className="top-btn primary" onClick={handleNewSession}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New session
          <span className="kbd-badge" style={{ background: 'rgba(0,0,0,0.18)', borderColor: 'rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.85)' }}>C</span>
        </button>
      </div>

      {/* ── NAV ── */}
      <Sidebar
        user={typedUser}
        initials={initials}
        email={email}
        onSignOut={signOut}
        collapsed={sidebarCollapsed}
        onToggle={() => toggleSidebar('sidebarCollapsed')}
      />

      {/* ── MAIN ── */}
      <Routes>
        <Route path="/"            element={<TimerPage />} />
        <Route path="/settings"    element={<SettingsPage />} />
        <Route path="/stats"       element={<StatsPage />} />
        <Route path="/notes"       element={<NotesPage />} />
        <Route path="/flashcards"  element={<FlashcardsPage />} />
        <Route path="/timetable"   element={<TimetablePage />} />
        <Route path="/past-papers" element={<PastPapersPage />} />
      </Routes>

      {/* ── RAIL (hidden on non-timer routes) ── */}
      {showRail && <RightRail />}

      {/* ── OVERLAYS ── */}
      {showNewSession && (
        <NewSessionModal
          running={running}
          onStart={handleStartSession}
          onCancel={() => setShowNewSession(false)}
        />
      )}

      <CommandPalette
        open={showCmdPalette}
        onClose={() => setShowCmdPalette(false)}
        onNavigate={path => navigate(path)}
        onNewSession={() => { setShowCmdPalette(false); setShowNewSession(true) }}
      />

    </div>
  )
}
```

### 4e — Make Sidebar router-aware

- [ ] **Step 11: Update `src/components/Sidebar.tsx`**

**Add router imports** at the top of the file:

```tsx
import { useNavigate, useLocation } from 'react-router-dom'
```

**Update the `SidebarProps` interface** — remove `activeView` and `onSettings`:

```tsx
interface SidebarProps {
  user:      User
  initials:  string
  email:     string
  onSignOut: () => void
  collapsed: boolean
  onToggle:  () => void
}
```

**Update the component signature** — remove `activeView` and `onSettings` from destructuring:

```tsx
export default function Sidebar({
  user, initials, email, onSignOut, collapsed, onToggle,
}: SidebarProps) {
```

**Add the hooks** inside the component body, right after the `displayName` line:

```tsx
  const navigate = useNavigate()
  const location = useLocation()
```

**Update the Timer nav item** — it is currently `<button className="nav-item active" title="Timer">`. Replace with:

```tsx
<button
  className={`nav-item${location.pathname === '/' ? ' active' : ''}`}
  title="Timer"
  onClick={() => navigate('/')}
>
  <IcTimer />
  <span className="nav-label">Timer</span>
  <span className="ni-shortcut">G T</span>
</button>
```

**Update the Settings nav item** — it currently uses `activeView === 'settings'` and `onClick={onSettings}`. Replace with:

```tsx
<button
  className={`nav-item${location.pathname === '/settings' ? ' active' : ''}`}
  onClick={() => navigate('/settings')}
  title="Settings"
>
  <IcSettings />
  <span className="nav-label">Settings</span>
</button>
```

### 4f — Update CommandPalette's `onNavigate` type

- [ ] **Step 12: Update `src/components/CommandPalette.tsx`**

**Change the `CommandPaletteProps` interface:**

```tsx
// Before:
interface CommandPaletteProps {
  open:         boolean
  onClose:      () => void
  onNavigate:   (view: 'timer' | 'settings') => void
  onNewSession: () => void
}

// After:
interface CommandPaletteProps {
  open:         boolean
  onClose:      () => void
  onNavigate:   (path: string) => void
  onNewSession: () => void
}
```

**Update the two navigate actions** in `actionCmds`:

```tsx
// Before:
{ id: 'goto-timer',     action: () => { onNavigate('timer');    onClose() } },
{ id: 'goto-settings',  action: () => { onNavigate('settings'); onClose() } },

// After:
{ id: 'goto-timer',     action: () => { onNavigate('/');          onClose() } },
{ id: 'goto-settings',  action: () => { onNavigate('/settings');  onClose() } },
```

### 4g — Verify and commit

- [ ] **Step 13: Verify build**

```bash
npm run build
```

Expected: no TypeScript errors, no missing imports. If Vite complains about any unused import (e.g. `Settings` directly in `App.tsx`), those were moved to `SettingsPage.tsx` — just confirm the import is removed from `App.tsx`.

- [ ] **Step 14: Manual smoke test**

Run `npm run dev` and verify:
1. `/` loads the timer. Timer nav item in sidebar is highlighted.
2. Click Settings in sidebar → navigates to `/settings` in the URL bar. Settings nav item highlighted.
3. Press `Escape` in Settings → back to `/`.
4. Press `Ctrl+K` → open command palette → "Go to Settings" → navigates to `/settings`.
5. Press `Ctrl+K` → "Go to Timer" → navigates to `/`.
6. Navigate to `/stats` directly in the address bar → stub page shows.
7. The Right Rail is hidden on `/settings` and visible on `/`.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "feat: add React Router — replace view state with URL routing, create page stubs"
```

---

## Task 5: Add `fetchSessions` to Supabase layer

The `sessions` table is being written to on every timer completion, but never read back. The Right Rail "All time" tab and future Stats dashboard need this data. This task wires the read path.

**Files:**
- Modify: `src/lib/supabase.ts`
- Modify: `src/store/useXPStore.ts`
- Modify: `src/store/useAuthStore.ts`

### 5a — Add `fetchSessions` to `supabase.ts`

- [ ] **Step 1: Add `fetchSessions` to `src/lib/supabase.ts`**

Add the following function after the existing `insertSession` function:

```ts
/**
 * Fetch completed sessions for a user, ordered newest-first.
 * Pass `limit` (default 200) to cap results.
 * Pass `from` / `to` as ISO strings to filter by date range.
 */
export async function fetchSessions(
  userId: string,
  options: { limit?: number; from?: string; to?: string } = {},
): Promise<{ data: SessionEntry[]; error: PostgrestError | null }> {
  let query = supabase
    .from('sessions')
    .select('id, type, completed_at, xp, subject_id, tag_id, duration_secs')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false })

  if (options.from)  query = query.gte('completed_at', options.from)
  if (options.to)    query = query.lte('completed_at', options.to)
  if (options.limit) query = query.limit(options.limit)

  const { data, error } = await query
  if (error || !data) return { data: [], error }

  const sessions: SessionEntry[] = data.map(r => ({
    id:           r.id           as string,
    type:         r.type         as TimerMode,
    completedAt:  r.completed_at as string,
    xp:           r.xp           as number,
    subjectId:    r.subject_id   as string | null,
    tagId:        r.tag_id       as string | null,
    durationSecs: r.duration_secs as number | null,
  }))

  return { data: sessions, error: null }
}
```

`TimerMode` is already imported at the top of `supabase.ts` via `import type { Subject, Tag, SessionEntry } from '../types'` — confirm `TimerMode` is included in that import, or add it:

```ts
import type { Subject, Tag, SessionEntry, TimerMode } from '../types'
```

### 5b — Add `_importSessionsFromSupabase` to `useXPStore`

- [ ] **Step 2: Add the method to the `XPState` interface** in `src/store/useXPStore.ts`

Find the interface (before the `create` call) and add one line:

```ts
interface XPState {
  totalXP:  number
  sessions: SessionEntry[]

  awardXP(sessionType: TimerMode, subjectId?: string | null, durationSecs?: number | null, tagId?: string | null): { xp: number; leveledUp: boolean; newLevel: number }
  _importFromSupabase(xp: number): void
  _importSessionsFromSupabase(sessions: SessionEntry[]): void   // ← add this line
  _reset(): void
}
```

- [ ] **Step 3: Implement the method** in the `create` body

Add the implementation right after `_importFromSupabase`:

```ts
      _importSessionsFromSupabase(sessions) {
        // sessions arrive newest-first from Supabase; reverse to oldest-first to match
        // the append order used by awardXP, then cap at MAX_LOCAL_SESSIONS
        const toStore = [...sessions].reverse().slice(0, MAX_LOCAL_SESSIONS)
        set({ sessions: toStore })
      },
```

### 5c — Call `fetchSessions` during sign-in sync

- [ ] **Step 4: Update `useAuthStore._syncFromSupabase`** in `src/store/useAuthStore.ts`

First, add `fetchSessions` to the import line at the top of the file:

```ts
// Before:
import { supabase, fetchUserXP, fetchLoginDates, fetchSubjects, fetchTags } from '../lib/supabase'

// After:
import { supabase, fetchUserXP, fetchLoginDates, fetchSubjects, fetchTags, fetchSessions } from '../lib/supabase'
```

Then update the `_syncFromSupabase` method to include sessions in the `Promise.all`:

```ts
  async _syncFromSupabase(userId) {
    const [xpResult, datesResult, subjectsResult, tagsResult, sessionsResult] = await Promise.all([
      fetchUserXP(userId),
      fetchLoginDates(userId),
      fetchSubjects(userId),
      fetchTags(userId),
      fetchSessions(userId, { limit: 200 }),
    ])

    if (xpResult.data) {
      useXPStore.getState()._importFromSupabase(xpResult.data.xp)
    }
    if (datesResult.data) {
      useStreakStore.getState()._importFromSupabase(datesResult.data)
    }
    if (subjectsResult.data) {
      useSubjectStore.getState()._importFromSupabase(subjectsResult.data)
    }
    if (tagsResult.data) {
      useTagStore.getState()._importFromSupabase(tagsResult.data)
    }
    if (sessionsResult.data.length > 0) {
      useXPStore.getState()._importSessionsFromSupabase(sessionsResult.data)
    }
  },
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 6: Manual smoke test**

Sign out and sign back in. Open browser devtools → Network tab. Filter for `sessions`. You should see a GET to the Supabase sessions table on sign-in. The Right Rail "Recent sessions" list should now show sessions from the database (not just the local-only localStorage copy).

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase.ts src/store/useXPStore.ts src/store/useAuthStore.ts
git commit -m "feat: add fetchSessions — sync session history from Supabase on sign-in"
```

---

## Task 6: Wire RightRail Today / Week / All-time tabs

The three tabs render but `tab` state is never used — all three show the same content. This task makes each tab render distinct content. Requires Task 4 (routing) to be complete because the "View all" link uses `<Link>`.

**Files:**
- Modify: `src/components/RightRail.tsx`

- [ ] **Step 1: Add the router `Link` import** at the top of `RightRail.tsx`

```tsx
import { Link } from 'react-router-dom'
```

- [ ] **Step 2: Add `WeekCard` component** — paste this after the `LevelCard` function and before `RecentSessions`:

```tsx
// ── week card ─────────────────────────────────────────────────────────────

function WeekCard({ sessions }: { sessions: SessionEntry[] }) {
  const days = useMemo(() => {
    const result: { label: string; dateStr: string; mins: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = toLocalDateStr(d)
      const label   = d.toLocaleDateString('en-US', { weekday: 'short' })
      const daySessions = sessions.filter(
        s => s.type === 'work' && dateOf(s.completedAt) === dateStr,
      )
      const mins = daySessions.reduce(
        (sum, s) => sum + (s.durationSecs ? Math.round(s.durationSecs / 60) : 25), 0,
      )
      result.push({ label, dateStr, mins })
    }
    return result
  }, [sessions])

  const totalMins = days.reduce((sum, d) => sum + d.mins, 0)
  const maxMins   = Math.max(1, ...days.map(d => d.mins))

  return (
    <div className="v2-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 500 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }}>
            <rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 17V11M12 17V8M15 17v-4"/>
          </svg>
          This week
        </span>
        <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'var(--text-mute)' }}>
          {totalMins === 0 ? '—' : fmtDuration(totalMins)} total
        </span>
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 52, marginBottom: 6 }}>
        {days.map(({ label, dateStr, mins }) => {
          const height = Math.round((mins / maxMins) * 44) + (mins > 0 ? 4 : 4)
          return (
            <div key={dateStr} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{
                width: '100%',
                background: mins > 0 ? 'var(--accent)' : 'var(--surface-3)',
                borderRadius: 3,
                height,
                minHeight: 4,
                opacity: mins > 0 ? 0.85 : 0.3,
                transition: 'height 300ms ease',
              }} />
              <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 8.5, color: 'var(--text-faint)' }}>
                {label[0]}
              </span>
            </div>
          )
        })}
      </div>

      {totalMins === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-faint)', textAlign: 'center', padding: '8px 0' }}>
          No focus sessions this week yet
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Geist Mono, monospace', fontSize: 10, color: 'var(--text-faint)', marginTop: 2 }}>
          <span>{days[0].label}</span>
          <span>Today</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Add `AllTimeCard` component** — paste immediately after `WeekCard`:

```tsx
// ── all-time card ─────────────────────────────────────────────────────────

function AllTimeCard({ sessions }: { sessions: SessionEntry[] }) {
  const totalXP      = useXPStore(s => s.totalXP)
  const workSessions = useMemo(() => sessions.filter(s => s.type === 'work'), [sessions])
  const totalMins    = useMemo(() =>
    workSessions.reduce((sum, s) =>
      sum + (s.durationSecs ? Math.round(s.durationSecs / 60) : 25), 0,
    ), [workSessions],
  )

  return (
    <div className="v2-card">
      <div style={{ fontSize: 11.5, color: 'var(--text-dim)', fontWeight: 500, marginBottom: 14 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ display: 'inline', marginRight: 6, verticalAlign: -2 }}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        All time
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-mute)' }}>Focus time</span>
          <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
            {totalMins === 0 ? '—' : fmtDuration(totalMins)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-mute)' }}>Sessions</span>
          <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
            {workSessions.length}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-mute)' }}>Total XP</span>
          <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 13, color: 'var(--xp)', fontWeight: 500 }}>
            {totalXP.toLocaleString()}
          </span>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text-faint)', textAlign: 'right' }}>
        Showing last {sessions.length} sessions
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update the main `RightRail` component** — replace the return statement with tab-conditional rendering and fix the "View all" link:

```tsx
export default function RightRail() {
  const [tab, setTab] = useState('today')
  const sessions      = useXPStore(s => s.sessions)

  return (
    <aside className="v2-rail">

      <div className="rail-tabs">
        {(['today', 'week', 'all'] as const).map(t => (
          <button
            key={t}
            className={`rail-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'today' ? 'Today' : t === 'week' ? 'Week' : 'All time'}
          </button>
        ))}
      </div>

      {tab === 'today' && (
        <>
          <TodayCard sessions={sessions} />
          <StreakCard />
          <LevelCard />

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
        </>
      )}

      {tab === 'week' && <WeekCard sessions={sessions} />}
      {tab === 'all'  && <AllTimeCard sessions={sessions} />}

    </aside>
  )
}
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 6: Manual smoke test**

Run `npm run dev`:
1. Right Rail shows "Today" content by default (TodayCard, StreakCard, LevelCard, Recent sessions).
2. Click "Week" tab → shows a 7-bar chart. If you have sessions this week, bars are filled; otherwise all bars are dim.
3. Click "All time" tab → shows Focus time, Sessions count, Total XP.
4. Back on "Today" tab, click "View all →" → navigates to `/stats` stub page.

- [ ] **Step 7: Commit**

```bash
git add src/components/RightRail.tsx
git commit -m "feat(rail): wire Today/Week/All-time tabs; fix View-all link to /stats"
```

---

## Task 7: Establish CSS file structure for new pages

New feature pages (Notes, Flashcards, Timetable, etc.) must not continue the inline-style pattern. This task creates the directory and convention file so future work has a clear, empty home for CSS from day one.

**Files:**
- Create: `src/styles/pages.css`
- Modify: `src/index.css` (add one `@import` line)

- [ ] **Step 1: Create `src/styles/pages.css`**

```css
/*
 * Page-level component styles
 * ─────────────────────────────────────────────────────────────────────────────
 * Convention:
 *   • Each feature page gets its own section in this file (or its own
 *     src/styles/<feature>.css imported below).
 *   • Use CSS classes, NOT inline style={} objects, for any rule that needs
 *     a media query, hover state, or animation.
 *   • CSS variable reference (defined in src/index.css):
 *       Layout:    --bg, --surface-1, --surface-2, --surface-3
 *       Text:      --text, --text-dim, --text-mute, --text-faint
 *       Borders:   --hairline, --hairline-2
 *       Accent:    --accent (focus mode: #8b85ff)
 *       Mode:      --focus (#8b85ff), --short (#4cb782), --long (#5e9eea)
 *       Gamified:  --xp, --streak
 *   • Mobile breakpoint: max-width 900px
 *       @media (max-width: 900px) { ... }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

/* ── Stats page (/stats) ─────────────────────────────────────────────────── */
.stats-page {
  grid-area: main;
  padding: 24px 32px;
  overflow-y: auto;
}

/* ── Notes page (/notes) ─────────────────────────────────────────────────── */
.notes-page {
  grid-area: main;
  display: grid;
  grid-template-columns: 220px 1fr;
  overflow: hidden;
}

/* ── Flashcards page (/flashcards) ──────────────────────────────────────── */
.flashcards-page {
  grid-area: main;
  padding: 24px 32px;
  overflow-y: auto;
}

/* ── Timetable page (/timetable) ─────────────────────────────────────────── */
.timetable-page {
  grid-area: main;
  overflow: auto;
}

/* ── Past Papers page (/past-papers) ─────────────────────────────────────── */
.past-papers-page {
  grid-area: main;
  padding: 24px 32px;
  overflow-y: auto;
}

/* ── Mobile overrides (< 900px) ──────────────────────────────────────────── */
@media (max-width: 900px) {
  /*
   * Mobile work goes here when the mobile UI task begins.
   * At 900px: hide right rail, collapse sidebar, show bottom tab bar.
   */
}
```

- [ ] **Step 2: Import from `src/index.css`**

Open `src/index.css` and add this line **at the very top** (before any other rules):

```css
@import './styles/pages.css';
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: no errors. Vite processes CSS `@import` at build time — this will be inlined.

- [ ] **Step 4: Commit**

```bash
git add src/styles/pages.css src/index.css
git commit -m "chore: create src/styles/pages.css convention file for new feature pages"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Dead code removal (`ss.mjs`, `design-v2/`) — Task 1
- ✅ Error Boundary — Task 2
- ✅ TagPicker extraction — Task 3
- ✅ React Router (full routing shell, all planned pages stubbed) — Task 4
- ✅ `fetchSessions` (Supabase read path + store hydration) — Task 5
- ✅ RightRail tabs wired (Today/Week/All-time, "View all" link) — Task 6
- ✅ Inline style prep (CSS convention file, mobile breakpoint documented) — Task 7

**Placeholder scan:** No TBD, no "implement later", no "similar to Task N", no steps without code.

**Type consistency:**
- `SessionEntry` — used in Tasks 5 and 6; imported from `../types` in both files ✅
- `TimerMode` — used in `fetchSessions` cast; must be in the `supabase.ts` type import ✅ (noted in Task 5 Step 1)
- `useTagPicker` return type — matches `AddTagForm` props in Task 3 ✅
- `onNavigate: (path: string) => void` — CommandPalette interface updated in Task 4f, App calls `navigate(path)` ✅
- `SidebarProps` — `activeView` and `onSettings` removed in Task 4e, App.tsx no longer passes them ✅

---

*Total estimated wall-clock time: ~2 hours if done sequentially, ~45 min if Tasks 1–3 are parallelised.*
