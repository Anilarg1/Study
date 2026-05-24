# Quick Wins — Subjects Inline Add, Filter Bar Tag Picker, Palette Pre-fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire three already-stubbed UI affordances: the Subjects "+" button in the sidebar, the "+ Tag" pill in the filter bar, and the "New session" label in the command palette.

**Architecture:** All state already exists in `useSubjectStore` (`subjects`, `activeId`, `setActiveId`, `addSubject`). Every task is purely presentational wiring — no new stores, no DB changes. Task 1 extracts a shared constant so Tasks 2 and 4 can both use it without duplication.

**Tech Stack:** React 18, TypeScript (strict), Zustand, Tailwind (only in SubjectPicker), inline styles everywhere else (follow existing file convention).

---

## File Map

| File | Action |
|---|---|
| `src/lib/subjects.ts` | **Create** — exports `SUBJECT_COLORS` |
| `src/components/SubjectPicker.tsx` | **Modify** — import `SUBJECT_COLORS` from `../lib/subjects` instead of local const |
| `src/components/Sidebar.tsx` | **Modify** — add React hooks import, `addSubject` from store, inline add panel state + JSX |
| `src/components/PomodoroTimer.tsx` | **Modify** — add `showTagPicker` state + ref, wire `+ Tag` pill, render subject dropdown |
| `src/components/CommandPalette.tsx` | **Modify** — add `activeId` selector, make "New session" label dynamic |

---

## Task 1 — Extract `SUBJECT_COLORS` to shared module

**Files:**
- Create: `src/lib/subjects.ts`
- Modify: `src/components/SubjectPicker.tsx`

- [ ] **Step 1: Create `src/lib/subjects.ts`**

```ts
// src/lib/subjects.ts

export const SUBJECT_COLORS = [
  '#7c6af0', // accent purple
  '#4ade80', // green
  '#fbbf24', // amber
  '#f87171', // red
  '#38bdf8', // sky
  '#fb7185', // rose
  '#a78bfa', // violet
  '#34d399', // emerald
]
```

- [ ] **Step 2: Update `SubjectPicker.tsx` — replace local const with import**

In `src/components/SubjectPicker.tsx`, replace the local declaration (lines 5–15):

```tsx
// ─── Color palette (matches theme tokens) ────────────────────────────────────
export const SUBJECT_COLORS = [
  '#7c6af0', // accent purple
  '#4ade80', // green
  '#fbbf24', // amber
  '#f87171', // red
  '#38bdf8', // sky
  '#fb7185', // rose
  '#a78bfa', // violet
  '#34d399', // emerald
]
```

with:

```tsx
import { SUBJECT_COLORS } from '../lib/subjects'
```

The rest of `SubjectPicker.tsx` is unchanged — it already uses `SUBJECT_COLORS` by name throughout.

- [ ] **Step 3: Verify the dev server still compiles**

```bash
npm run dev
```

Open the app → open the subject picker in `NewSessionModal` → confirm the color swatches still render and subjects can be added. No visual change expected.

- [ ] **Step 4: Commit**

```bash
git add src/lib/subjects.ts src/components/SubjectPicker.tsx
git commit -m "refactor: extract SUBJECT_COLORS to src/lib/subjects.ts"
```

---

## Task 2 — Sidebar inline add-subject panel

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Add React hooks import and `SUBJECT_COLORS` import**

`Sidebar.tsx` currently has no React import. Add these two imports at the very top of the file, before the existing imports:

```tsx
import { useState, useRef, useEffect } from 'react'
import { SUBJECT_COLORS } from '../lib/subjects'
```

- [ ] **Step 2: Pull `addSubject` from the store**

Inside the `Sidebar` component, the current store reads are:

```tsx
const subjects      = useSubjectStore(s => s.subjects)
```

Add `addSubject` on the next line:

```tsx
const subjects      = useSubjectStore(s => s.subjects)
const addSubject    = useSubjectStore(s => s.addSubject)
```

- [ ] **Step 3: Add local state and handlers**

Add this block immediately after the `addSubject` line (before the `return`):

```tsx
const [showAddPanel, setShowAddPanel] = useState(false)
const [newName,      setNewName]      = useState('')
const [newColor,     setNewColor]     = useState(SUBJECT_COLORS[0])
const [addError,     setAddError]     = useState<string | null>(null)
const nameRef = useRef<HTMLInputElement>(null)

// Auto-focus the name input whenever the panel opens
useEffect(() => {
  if (showAddPanel) nameRef.current?.focus()
}, [showAddPanel])

function toggleAddPanel() {
  setShowAddPanel(p => !p)
  setNewName('')
  setNewColor(SUBJECT_COLORS[0])
  setAddError(null)
}

async function handleAddSubject() {
  if (!newName.trim()) return
  setAddError(null)
  const subject = await addSubject(newName.trim(), newColor)
  if (subject) {
    setShowAddPanel(false)
    setNewName('')
    setNewColor(SUBJECT_COLORS[0])
  } else {
    setAddError('Could not save — check your connection.')
  }
}

function handleAddKeyDown(e: React.KeyboardEvent) {
  if (e.key === 'Enter')  handleAddSubject()
  if (e.key === 'Escape') toggleAddPanel()
}
```

- [ ] **Step 4: Wire the "New subject" `+` button**

Find the existing Subjects section header (currently around line 181):

```tsx
{!collapsed && (
  <div className="nav-section-hd">
    <span className="nav-section-label">Subjects</span>
    <button className="nav-section-ic" title="New subject"><IcPlus /></button>
  </div>
)}
```

Replace it with:

```tsx
{!collapsed && (
  <div className="nav-section-hd">
    <span className="nav-section-label">Subjects</span>
    <button
      className="nav-section-ic"
      title={showAddPanel ? 'Cancel' : 'New subject'}
      onClick={toggleAddPanel}
    >
      <IcPlus />
    </button>
  </div>
)}
```

- [ ] **Step 5: Render the inline add panel**

Add the panel JSX immediately after the closing `)}` of the section header block above, before the "No subjects yet" empty state:

```tsx
{showAddPanel && !collapsed && (
  <div style={{ padding: '6px 8px 8px', borderBottom: '1px solid var(--hairline)' }}>
    <input
      ref={nameRef}
      type="text"
      value={newName}
      onChange={e => { setNewName(e.target.value); setAddError(null) }}
      onKeyDown={handleAddKeyDown}
      placeholder="Subject name"
      maxLength={40}
      style={{
        width: '100%',
        background: 'var(--surface-3)',
        border: '1px solid var(--hairline-2)',
        borderRadius: 6,
        padding: '5px 8px',
        fontSize: 12,
        color: 'var(--text)',
        outline: 'none',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
      }}
    />
    <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
      {SUBJECT_COLORS.map(c => (
        <button
          key={c}
          onClick={() => setNewColor(c)}
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: c,
            border: newColor === c ? '2px solid var(--text)' : '2px solid transparent',
            outline: newColor === c ? '2px solid var(--surface-3)' : 'none',
            outlineOffset: 1,
            padding: 0,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
    {addError && (
      <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: '#f87171' }}>
        {addError}
      </span>
    )}
  </div>
)}
```

- [ ] **Step 6: Verify manually**

```bash
npm run dev
```

- Click "+" in the Subjects section header → input appears, auto-focused
- Type a name, pick a color, press Enter → subject appears in the list, panel closes
- Click "+" again → panel opens fresh (empty name, default color)
- Press Escape while panel is open → panel closes
- Collapse the sidebar → panel disappears (it's wrapped in `!collapsed`)
- Trigger a network error (disable network in DevTools) and try to add → error message appears

- [ ] **Step 7: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: sidebar subjects + inline add panel"
```

---

## Task 3 — Filter bar "+ Tag" subject picker dropdown

**Files:**
- Modify: `src/components/PomodoroTimer.tsx`

- [ ] **Step 1: Add `showTagPicker` state and `tagPickerRef`**

In `PomodoroTimer`'s main component body, the existing refs are declared around line 251:

```tsx
const tickRef      = useRef<ReturnType<typeof setInterval> | null>(null)
const chipsRef     = useRef<HTMLDivElement>(null)
const settingsRef  = useRef<HTMLDivElement>(null)
```

Add `tagPickerRef` and `showTagPicker` on the next lines:

```tsx
const tickRef      = useRef<ReturnType<typeof setInterval> | null>(null)
const chipsRef     = useRef<HTMLDivElement>(null)
const settingsRef  = useRef<HTMLDivElement>(null)
const tagPickerRef = useRef<HTMLDivElement>(null)

const [showTagPicker, setShowTagPicker] = useState(false)
```

- [ ] **Step 2: Add the outside-click handler for the tag picker**

The component already has a `showSettings` outside-click handler (around line 256). Add this block directly after it:

```tsx
// ── close tag picker on outside click ────────────────────────────────────
useEffect(() => {
  if (!showTagPicker) return
  function onOutside(e: MouseEvent) {
    if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node)) {
      setShowTagPicker(false)
    }
  }
  document.addEventListener('mousedown', onOutside)
  return () => document.removeEventListener('mousedown', onOutside)
}, [showTagPicker])
```

- [ ] **Step 3: Replace the static "+ Tag" button with the wired version**

In the filter bar JSX (around line 363), find and replace the existing static `+ Tag` button:

```tsx
<button className="filter-pill" style={{ borderStyle: 'dashed', color: 'var(--text-mute)' }}>
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
  Tag
</button>
```

Replace with:

```tsx
<div style={{ position: 'relative' }} ref={tagPickerRef}>
  <button
    className="filter-pill"
    style={{ borderStyle: 'dashed', color: 'var(--text-mute)' }}
    onClick={() => setShowTagPicker(p => !p)}
  >
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
    Tag
  </button>

  {showTagPicker && (
    <div style={{
      position: 'absolute',
      top: 'calc(100% + 4px)',
      left: 0,
      background: 'var(--surface)',
      border: '1px solid var(--hairline)',
      borderRadius: 8,
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      minWidth: 160,
      zIndex: 50,
      overflow: 'hidden',
    }}>
      {subjects.length === 0 && (
        <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-faint)', fontFamily: 'inherit' }}>
          No subjects yet
        </div>
      )}
      {subjects.map(s => (
        <button
          key={s.id}
          onClick={() => { selectSubject(s.id); setShowTagPicker(false) }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '7px 12px',
            fontSize: 12,
            color: activeId === s.id ? 'var(--text)' : 'var(--text-dim)',
            background: activeId === s.id ? 'var(--surface-3)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'inherit',
          }}
        >
          <span style={{
            width: 8, height: 8,
            borderRadius: '50%',
            background: s.color,
            flexShrink: 0,
            display: 'inline-block',
          }} />
          {s.name}
        </button>
      ))}
      {activeId && (
        <>
          <div style={{ borderTop: '1px solid var(--hairline)', margin: '2px 0' }} />
          <button
            onClick={() => { selectSubject(null); setShowTagPicker(false) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              padding: '7px 12px',
              fontSize: 12,
              color: 'var(--text-mute)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
            }}
          >
            Clear
          </button>
        </>
      )}
    </div>
  )}
</div>
```

Note: `selectSubject` is already defined in this component (line ~332) — it calls both `setActiveId` and `setSubjectId`. Use it; don't duplicate.

- [ ] **Step 4: Verify manually**

```bash
npm run dev
```

- Click `+ Tag` → dropdown appears listing your subjects
- Click a subject → dropdown closes, colored pill appears in the filter bar
- Click `+ Tag` again → dropdown shows that subject highlighted
- Click "Clear" → dropdown closes, colored pill disappears
- Click anywhere outside the dropdown → it closes
- With no subjects created yet → dropdown shows "No subjects yet"

- [ ] **Step 5: Commit**

```bash
git add src/components/PomodoroTimer.tsx
git commit -m "feat: filter bar + tag picker dropdown"
```

---

## Task 4 — Command palette dynamic "New session" label

**Files:**
- Modify: `src/components/CommandPalette.tsx`

- [ ] **Step 1: Add `activeId` selector**

`CommandPalette.tsx` already reads from `useSubjectStore` at lines 62–63:

```tsx
const subjects    = useSubjectStore(s => s.subjects)
const setActiveId = useSubjectStore(s => s.setActiveId)
```

Add `activeId` on the next line:

```tsx
const subjects    = useSubjectStore(s => s.subjects)
const setActiveId = useSubjectStore(s => s.setActiveId)
const activeId    = useSubjectStore(s => s.activeId)
```

- [ ] **Step 2: Derive `activeSubject`**

Add this line immediately after the three store selectors:

```tsx
const activeSubject = subjects.find(s => s.id === activeId) ?? null
```

- [ ] **Step 3: Update the "New session" label**

Find the `actionCmds` array (around line 73). The `new-session` entry currently reads:

```tsx
{
  id:     'new-session',
  label:  'New session',
  hint:   'C',
  icon:   <IcPlus />,
  action: () => { onNewSession(); onClose() },
},
```

Replace it with:

```tsx
{
  id:     'new-session',
  label:  activeSubject ? `New session · ${activeSubject.name}` : 'New session',
  hint:   'C',
  icon:   <IcPlus />,
  action: () => { onNewSession(); onClose() },
},
```

- [ ] **Step 4: Verify manually**

```bash
npm run dev
```

- With no subject active: open palette (`Ctrl+K`) → first action reads "New session"
- Set a subject via the filter bar `+ Tag` → open palette → first action reads "New session · Physics" (or whichever subject)
- Press Enter on "New session · Physics" → `NewSessionModal` opens with Physics pre-selected in the subject picker (no extra code needed — `SubjectPicker` already reads `activeId` from the store)
- Clear the subject → open palette → label reverts to "New session"

- [ ] **Step 5: Build check**

```bash
npm run build
```

Expected: exits 0 with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/CommandPalette.tsx
git commit -m "feat: command palette new session label reflects active subject"
```

---

## Final check

After all four tasks, run one last build to confirm everything compiles cleanly together:

```bash
npm run build
```

Expected output: `✓ built in X.XXs` with 0 errors and 0 warnings (or only pre-existing warnings).

Then push:

```bash
git push
```

Vercel will auto-deploy from `main`.
