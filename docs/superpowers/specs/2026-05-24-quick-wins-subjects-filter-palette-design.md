# Quick Wins — Subjects Inline Add, Filter Bar Tag Picker, Palette Pre-fill

**Date:** 2026-05-24  
**Status:** Approved

---

## Scope

Three small, self-contained changes. No new DB tables. No new stores. All state already exists — this work is wiring.

---

## 1 — Nav Subjects "+" → Inline Add Panel

**File:** `src/components/Sidebar.tsx`  
**Shared extract:** `src/lib/subjects.ts` (new)

### What changes

The `IcPlus` button in the Subjects section header already exists with no `onClick`. Wire it up to show an inline add form directly below the header row.

### Shared constant

`SUBJECT_COLORS` is currently defined locally in `SubjectPicker.tsx`. Extract it to `src/lib/subjects.ts` and re-import it there. `Sidebar.tsx` also imports from that file.

### State added to Sidebar

```ts
const [showAddPanel, setShowAddPanel] = useState(false)
const [newName,      setNewName]      = useState('')
const [newColor,     setNewColor]     = useState(SUBJECT_COLORS[0])
const [addError,     setAddError]     = useState<string | null>(null)
```

Also pull `addSubject` from `useSubjectStore` (currently Sidebar only reads `subjects`).

### Behaviour

- Clicking "+" sets `showAddPanel(true)`. Clicking it again while open closes it and resets form.
- Form renders immediately below the "Subjects" `nav-section-hd` row, only when `!collapsed`.
- Name input is auto-focused on open.
- Color row: dots from `SUBJECT_COLORS`, selected dot has a ring/outline.
- **Enter** → calls `addSubject(newName.trim(), newColor)`. On success: close panel, reset form. On failure: show `addError` inline.
- **Escape** → close panel, reset form.
- Empty name → no-op (do not call store).
- Panel collapses (disappears) if sidebar is collapsed while it is open.

### Styling

Follows existing sidebar token conventions (`var(--text-faint)`, `var(--hairline)`, etc.). No new CSS classes needed beyond minor inline styles consistent with the nav.

---

## 2 — Filter Bar "+ Tag" → Subject Picker Dropdown

**File:** `src/components/PomodoroTimer.tsx`

### What changes

The dashed `+ Tag` pill already exists with no handler. Wire it to open a subject list dropdown anchored below it. Selecting a subject sets it as the active subject (which already drives the colored pill via existing code).

### State added to PomodoroTimer

```ts
const [showTagPicker, setShowTagPicker] = useState(false)
const tagPickerRef = useRef<HTMLDivElement>(null)
```

### Behaviour

- Clicking `+ Tag` toggles `showTagPicker`.
- Outside-click handler (mousedown on document, same pattern as `SubjectPicker`) closes the dropdown.
- Dropdown lists all subjects from `useSubjectStore`. Each row: color dot + name.
- Clicking a subject → `setActiveId(s.id)` → close dropdown.
- If a subject is already active, a **"Clear"** row appears at the bottom of the list → `setActiveId(null)` → close.
- Empty subjects list → show "No subjects yet" message.

### Positioning

Wrap the `+ Tag` pill in a `position: relative` `<div>`. The dropdown is `position: absolute; top: 100%; left: 0` with `z-index` above the filter bar.

### No changes to existing pills

The "Focus session" pill and the active-subject dismissable pill are untouched. The dropdown only sets `activeId`; the rest of the filter bar already reacts to it.

---

## 3 — Command Palette "New Session" Label + Implicit Pre-fill

**File:** `src/components/CommandPalette.tsx`

### What changes

One extra selector + a template string. No new props, no new callbacks.

### State added to CommandPalette

```ts
const activeId = useSubjectStore(s => s.activeId)
// subjects is already read from the store
const activeSubject = subjects.find(s => s.id === activeId) ?? null
```

### Label

```ts
label: activeSubject ? `New session · ${activeSubject.name}` : 'New session'
```

### Pre-fill (already free)

`NewSessionModal` contains a `SubjectPicker` that independently reads `activeId` from `useSubjectStore`. When the modal opens, SubjectPicker renders with the active subject already selected. No prop changes needed.

### Scope boundary

This feature only changes the label. It does not skip the modal, change the action callback, or alter keyboard shortcuts.

---

## What this is NOT

- **Not a tags system.** Tags (cross-content taxonomy: sessions, notes, past papers) are a separate, future feature. The `+ Tag` pill sets the active *subject*, not a tag. The naming in the UI ("+ Tag") is left as-is per the existing design; it will be repurposed when the real tags system is built.
- **No DB changes.** Everything uses existing `subjects` table and `useSubjectStore`.
- **No new routes or views.**

---

## Files touched

| File | Change |
|---|---|
| `src/lib/subjects.ts` | New — exports `SUBJECT_COLORS` |
| `src/components/SubjectPicker.tsx` | Import `SUBJECT_COLORS` from `src/lib/subjects.ts` instead of local const |
| `src/components/Sidebar.tsx` | Add inline add panel, wire "+" button |
| `src/components/PomodoroTimer.tsx` | Wire "+ Tag" pill, add subject dropdown |
| `src/components/CommandPalette.tsx` | Dynamic label for "New session" |
