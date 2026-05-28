# Planner — Design Spec

**Date:** 2026-05-28
**Status:** Approved for implementation

---

## Overview

A dedicated `/planner` page combining a weekly calendar (Google Calendar-style, optimised for feel over features) with a task inbox and goals summary sidebar. Replaces the stale Timetable stub. Absorbs goal management from the right-rail GoalsPanel.

Tasks and the study timer are intentionally separate — the planner is for planning, the timer is for executing.

---

## Scope

**In scope:**
- `/planner` route — calendar-first layout with sidebar
- Task CRUD: create, edit, complete, delete
- Optional time slots on tasks (date required, time optional)
- Priority flags (P1 / P2 / P3 / None)
- Recurring tasks (daily / weekly / monthly)
- Goals summary strip in sidebar (read-only, links to `/planner`)
- GoalsPanel in right rail simplified to read-only pills
- Timetable nav item renamed to Planner

**Out of scope:**
- Drag-to-reschedule (deferred — add after initial release)
- Task subtasks
- Shared/collaborative tasks
- Google Calendar sync
- Task notifications/reminders (tracked separately in backlog)

---

## Data Model

### New: `tasks` table

```sql
CREATE TABLE tasks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id     UUID REFERENCES subjects(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  notes          TEXT,
  due_date       DATE NOT NULL,
  due_time       TIME,
  priority       SMALLINT NOT NULL DEFAULT 4,  -- 1=urgent 2=high 3=medium 4=none
  is_recurring   BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence     TEXT CHECK (recurrence IN ('daily', 'weekly', 'monthly')),
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Priority encoding:** 1 = P1 (urgent), 2 = P2 (high), 3 = P3 (medium), 4 = no priority. Lower number = higher urgency.

**Recurring tasks:** When `is_recurring = TRUE`, completing the task creates the next occurrence at `due_date + recurrence interval` with `completed_at = NULL`. The completed instance is kept as a record.

**Goals:** Reuse the existing `goals` table (from Architecture Hardening). No new table.

### RLS

```sql
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own tasks"
  ON tasks FOR ALL USING (auth.uid() = user_id);
```

---

## TypeScript Types

```typescript
// src/types/index.ts additions

export type TaskPriority = 1 | 2 | 3 | 4

export type RecurrenceRule = 'daily' | 'weekly' | 'monthly'

export interface Task {
  id:           string
  user_id:      string
  subject_id:   string | null
  title:        string
  notes:        string | null
  due_date:     string          // ISO date 'YYYY-MM-DD'
  due_time:     string | null   // 'HH:MM' 24h storage; displayed as 12h (e.g. '19:00' → '7pm')
  priority:     TaskPriority
  is_recurring: boolean
  recurrence:   RecurrenceRule | null
  completed_at: string | null   // ISO timestamp
  created_at:   string
}
```

---

## Routing & Navigation

| Route | Component | Description |
|---|---|---|
| `/planner` | `PlannerPage` | Replaces `/timetable` |

- `src/App.tsx`: replace `TimetablePage` lazy import with `PlannerPage`
- `src/components/Sidebar.tsx`: rename "Timetable" nav item to "Planner", update route to `/planner`
- GoalsPanel in right rail: strip to read-only goal pills + "View all →" link. Remove inline edit. Goal management lives on `/planner`.

---

## Page Layout

Two-column layout, fixed. Neither column scrolls independently.

```
┌──────────────────────────────────────────────────────────────┐
│  /planner                                          < > Today  │
├──────────────────┬───────────────────────────────────────────┤
│  GOALS           │  Mon   Tue   Wed   Thu   Fri   Sat   Sun  │
│  ─────────────── │ ────────────────────────────────────────  │
│  Maths A*  62%  │  [all-day chips — date-only tasks]        │
│  40h/mo    38%  │ ────────────────────────────────────────  │
│  Streak    55%  │  6am                                       │
│                  │  7am   ┌──────┐                           │
│  TASKS           │  8am   │Chem  │                           │
│  ─────────────── │  9am   │paper │                           │
│  Today (3)       │  3pm   └──────┘                           │
│  □ Past paper 7pm│  7pm          ┌──────┐                    │
│  □ Revise integ. │  8pm          │Maths │                    │
│  □ Chapter 4     │  9pm          └──────┘                    │
│                  │                                            │
│  Tomorrow (1)    │                                            │
│  □ Mock paper 2  │                                            │
│                  │                                            │
│  + Add task      │                                            │
└──────────────────┴───────────────────────────────────────────┘
```

**Sidebar:** 220px fixed width.
**Calendar:** fills remaining width.

---

## Sidebar — PlannerSidebar

### Goals strip

- Reads from `useGoalsStore`
- Each goal: subject colour dot + goal label + mini progress bar + percentage
- Max 4 goals shown, "View all" link if more
- Collapsible with a chevron toggle

### Task inbox

Tasks grouped into date buckets:

| Bucket | Logic |
|---|---|
| Overdue | `due_date < today` and not completed |
| Today | `due_date === today` |
| Tomorrow | `due_date === tomorrow` |
| This week | `due_date` within current week, beyond tomorrow |
| Later | `due_date` beyond current week |

Each bucket shows a count badge. Buckets with no tasks are hidden.

**Task row:**
- Checkbox (click to complete)
- Title (strikethrough + muted when completed)
- Time badge if `due_time` is set (e.g. "7pm")
- Subject colour dot if `subject_id` is set
- Priority left border: P1 = red, P2 = amber, P3 = blue, none = no border

**Completed tasks** stay visible for the rest of the calendar day, then disappear the following day.

**"+ Add task"** button pinned at the bottom of the sidebar. Opens `TaskCreateModal` with today's date pre-filled.

---

## Calendar — WeekCalendar

### Header

- Day columns: Mon–Sun
- Each column header shows day name + date number
- Today's column: accent-coloured date circle, faint accent tint on entire column
- `< >` arrows step one week at a time
- "Today" button in top-right returns to current week

### All-day row

Date-only tasks (no `due_time`) appear here as small chips using the subject's colour. If no subject, use the accent colour. Chips are truncated to fit.

### Time grid

- Hours: 6am–11pm
- 30-min slot height: 24px (so 1 hour = 48px)
- Timed tasks render as blocks:
  - Height = duration in minutes × (48 / 60). There is no `end_time` field — tasks with a `due_time` always render at a fixed 60 min height (display only).
  - Left-border tinted with subject colour; block background = 12% opacity of subject colour
  - Shows title + time label
- Clicking an empty slot opens `TaskCreateModal` with that day + time pre-filled
- Clicking a task block opens `TaskCreateModal` in edit mode

### Overflow

If a time column has multiple overlapping tasks, they render side-by-side with equal width split.

---

## TaskCreateModal

Used for both create and edit. Modal overlays the page.

**Fields:**

```
Title         [text input — required]
Subject       [dropdown with colour dots — optional]
Due date      [date picker — required]
Time          [time input HH:MM — optional]
Priority      [● P1  ○ P2  ○ P3  ○ None]
              ─────────────────────────────
Recurring     [☐ Repeat this task]
               └─ if checked: [○ Daily  ○ Weekly  ○ Monthly]
Notes         [text input — optional]
```

**Submit:** "Add task" (create) or "Save" (edit).

**Delete:** Edit mode only — "Delete task" link at the bottom of the modal. Confirmation inline: "Delete this task?" with Cancel / Delete.

**Recurring task deletion:** If deleting a recurring task, show: "Delete just this occurrence" vs "Delete all future occurrences."

---

## Store — usePlannerStore

```typescript
interface PlannerState {
  tasks:      Task[]
  isLoading:  boolean
  weekStart:  string          // ISO date of current week's Monday; initialised to Monday of today's week on first mount

  loadTasks(userId: string): Promise<void>
  createTask(t: Omit<Task, 'id' | 'created_at'>): Promise<void>
  updateTask(id: string, updates: Partial<Task>): Promise<void>
  deleteTask(id: string): Promise<void>
  completeTask(id: string): Promise<void>   // sets completed_at; creates next occurrence if recurring
  setWeekStart(date: string): void
  _reset(): void
}
```

All writes are optimistic — local state updates before the Supabase call resolves.

---

## Supabase Helpers

```typescript
// src/lib/supabase.ts additions

fetchTasks(userId: string): Promise<Task[]>
createTask(task: Omit<Task, 'id' | 'created_at'>): Promise<Task | null>
updateTask(id: string, updates: Partial<Task>): Promise<void>
deleteTask(id: string): Promise<void>
```

---

## GoalsPanel Simplification

The existing `GoalsPanel` component in the right rail becomes a compact read-only strip:

- 2–3 goal pills: colour dot + label + progress bar
- "Planner →" link at the bottom
- Remove the pencil edit button and inline edit panel
- Goal creation/editing moves to a future Goals management UI within `/planner` (deferred — for now goals are seeded from defaults and editable via the existing upsertGoal store action)

---

## Files to Create

| File | Purpose |
|---|---|
| `src/pages/PlannerPage.tsx` | Route component, owns weekStart state |
| `src/components/planner/PlannerSidebar.tsx` | Goals strip + task inbox |
| `src/components/planner/WeekCalendar.tsx` | 7-column time grid |
| `src/components/planner/TaskBlock.tsx` | Timed task block inside calendar |
| `src/components/planner/TaskChip.tsx` | Date-only task chip in all-day row |
| `src/components/planner/TaskCreateModal.tsx` | Create/edit form |
| `src/store/usePlannerStore.ts` | Task state + Supabase sync |

## Files to Modify

| File | Change |
|---|---|
| `src/App.tsx` | Swap TimetablePage → PlannerPage |
| `src/components/Sidebar.tsx` | Rename Timetable → Planner, update route |
| `src/components/GoalsPanel.tsx` | Strip to read-only pills + link |
| `src/lib/supabase.ts` | Add task CRUD helpers |
| `src/types/index.ts` | Add `Task`, `TaskPriority`, `RecurrenceRule` types |

---

## Non-goals

- Drag-to-reschedule (deferred)
- Subtasks
- Task sharing or collaboration
- Google Calendar / iCal sync
- Task-based push notifications (in backlog as "Study Reminders")
- Inline goal editing on `/planner` (deferred — goals editable via store for now)
