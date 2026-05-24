# Tags — Design Spec
**Date:** 2026-05-24  
**Status:** Approved

## Problem

Subjects and tags are currently the same concept. The user wants them to be distinct:
- **Subject** — *what* you're studying (Chemistry, Maths, Physics). Has a colour. Single-select per session.
- **Tag** — *how* you're studying (homework, revision, pastpaper, flashcards). No colour. Single-select per session. User-created.

---

## Data Model

### New table: `tags`

| Column       | Type         | Notes                          |
|--------------|--------------|--------------------------------|
| `id`         | `uuid`       | PK, `gen_random_uuid()`        |
| `user_id`    | `uuid`       | FK → `auth.users`, cascade delete |
| `name`       | `text`       | e.g. `"homework"`              |
| `created_at` | `timestamptz`| `now()`                        |

RLS: `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)`.

### Modified table: `sessions`

Add one nullable column:

```sql
alter table sessions add column if not exists tag_id uuid references tags(id);
```

No cascade delete — deleting a tag leaves `tag_id` as `null` on historical sessions.

---

## TypeScript Types (`src/types/index.ts`)

```ts
export interface Tag {
  id:         string
  name:       string
  created_at: string
}

// SessionEntry gains one field:
export interface SessionEntry {
  id:           string
  type:         TimerMode
  completedAt:  string
  xp:           number
  subjectId:    string | null
  tagId:        string | null   // ← new
  durationSecs: number | null
}
```

---

## Supabase Helpers (`src/lib/supabase.ts`)

Three new functions mirroring the subject helpers:

- `fetchTags(userId)` — select all tags for a user, ordered by `created_at asc`
- `createTag(userId, { name })` — insert + return the new row
- `removeTag(tagId)` — delete by id

`insertSession` updated to include `tag_id: session.tagId ?? null`.

---

## Store: `useTagStore` (new file)

Mirrors `useSubjectStore` without colours.

```ts
interface TagState {
  tags:    Tag[]
  addTag(name: string): Promise<Tag | null>
  deleteTag(id: string): Promise<void>
  _importFromSupabase(tags: Tag[]): void
  _reset(): void
}
```

Persisted under key `notebook-tags` (version 1).

---

## Store changes

### `useTimerStore`
- Add `tagId: string | null` (default `null`) to state
- Add `setTagId(id: string | null)` action
- Include `tagId` in `partialize`

### `useXPStore`
- `awardXP(sessionType, subjectId, durationSecs, tagId?)` gains an optional `tagId` parameter
- Passed into the `SessionEntry` created inside `awardXP`

### `useAuthStore._syncFromSupabase`
- Add `fetchTags(userId)` to the `Promise.all` alongside `fetchSubjects`
- On success: `useTagStore.getState()._importFromSupabase(tagsResult.data)`
- `useTagStore.getState()._reset()` added to `signOut`

---

## Component changes

### `NewSessionModal`

New "Tags" section inserted between Subject and Duration:

```
Subject
[● Chemistry] [● Physics] [● Maths]

Tags
[homework] [revision] [flashcards] [+ Add tag]

Duration
[25 min] [50 min] [90 min]    [−] [25] min [+]
```

- Chips are single-select (click to select, click again to deselect → `null`)
- `[+ Add tag]` opens a small inline text input; Enter to confirm, Escape to cancel
- Duplicate name check: if the typed name matches an existing tag (case-insensitive), select the existing one instead of creating a new row
- `onStart` signature changes to `(subjectId: string | null, durationMins: number, tagId: string | null) => void`

### `App.tsx`

`handleStartSession(subjectId, durationMins, tagId)`:
- Calls `setTimerTagId(tagId)` on the timer store (new action)
- Existing `setTimerSubject`, `setTimerDuration`, `setTimerMode`, `startTimer` calls unchanged

### `PomodoroTimer`

Reads `tagId` from `useTimerStore`.  
Passes it as the 4th argument to `awardXP(mode, subjectId, customDurations[mode], tagId)`.

### `RightRail — RecentSessions`

When a session has a `tagId`, look up the tag name and render a small inline pill alongside the subject name:

```
● Chemistry   revision   25 min   2m ago
```

Pill is plain text in `var(--text-mute)` with a thin border — no colour, just a label.

---

## Migration SQL

```sql
-- 1. Tags table
create table if not exists tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade not null,
  name       text not null,
  created_at timestamptz default now()
);

alter table tags enable row level security;

create policy "users manage own tags"
  on tags for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. Add tag_id to sessions
alter table sessions
  add column if not exists tag_id uuid references tags(id);
```

---

## What is NOT changing

- Subjects — no changes to the `subjects` table, `useSubjectStore`, or `SubjectPicker`
- XP rewards — tags have no effect on XP
- Session history that predates this feature — `tag_id` will be `null`, displayed as "no tag"
- Settings page — no tag management screen; tags are managed inline in the modal only
