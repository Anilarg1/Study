# Subjects Rework — Design Spec

**Date:** 2026-05-28  
**Status:** Approved for implementation

---

## Overview

Subjects are currently thin labels (name + color) attached to sessions. This rework makes subjects first-class entities with richer metadata, academic performance tracking, and their own hub page. The existing subject picker and session-level subject association are left unchanged.

---

## Scope

**In scope:**
- Richer subject data model (exam board, target grade, subject-level labels)
- `/subjects` index page — overview of all subjects with proficiency
- `/subjects/:id` hub page — per-subject stats, scores, grade boundaries
- Assessments system — past paper marks + school test scores, normalized to %, with configurable grade boundaries

**Out of scope (deferred):**
- Subject picker UX changes (current chips-row kept as-is)
- Notes, flashcards, timetable integration (hub stubs only)

---

## Data Model

### Additions to `subjects` table

```sql
ALTER TABLE subjects
  ADD COLUMN exam_board   TEXT,       -- nullable, e.g. "Edexcel IAL", "OCR A", "AQA"
  ADD COLUMN target_grade TEXT;       -- nullable, e.g. "A*", "90%", "7"
```

### New: `subject_labels` table

Reusable grouping tags applied to subjects. Separate concept from session-level tags.

```sql
CREATE TABLE subject_labels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subject_label_map (
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  label_id   UUID NOT NULL REFERENCES subject_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (subject_id, label_id)
);
```

A label (e.g. "A-Level") is defined once and can be applied to many subjects. Deleting a subject cascades to remove its label mappings. Deleting a label cascades to remove all its mappings.

### New: `assessments` table

Unified table for past paper marks and school test scores.

```sql
CREATE TABLE assessments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id     UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('past_paper', 'school_test')),
  title          TEXT NOT NULL,          -- e.g. "2024 Jan — Unit 4" or "Mock Exam 2"
  marks_obtained NUMERIC NOT NULL,
  marks_total    NUMERIC NOT NULL CHECK (marks_total > 0),
  sat_on         DATE NOT NULL,          -- date the assessment was taken
  paper_ref      UUID REFERENCES past_papers(id) ON DELETE SET NULL,  -- optional FK for past_paper type
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`percentage` is always derived: `ROUND(marks_obtained / marks_total * 100, 1)`. Never stored.

### New: `subject_grade_boundaries` table

Per-subject, per-user grade boundary configuration.

```sql
CREATE TABLE subject_grade_boundaries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  grade      TEXT NOT NULL,     -- e.g. "A*", "A", "B", "C", "D", "E"
  min_pct    NUMERIC NOT NULL,  -- lower bound (inclusive)
  max_pct    NUMERIC NOT NULL,  -- upper bound (exclusive, except for top grade)
  UNIQUE (user_id, subject_id, grade)
);
```

Default boundaries (applied when none are set for a subject):
`A*: 90–100, A: 75–89, B: 65–74, C: 55–64, D: 45–54, E: 35–44`

---

## Updated TypeScript Types

```typescript
// src/types/index.ts

export interface Subject {
  id:           string
  name:         string
  color:        string
  exam_board:   string | null   // new
  target_grade: string | null   // new
  created_at:   string
}

export interface SubjectLabel {
  id:   string
  name: string
}

export interface Assessment {
  id:             string
  subject_id:     string
  type:           'past_paper' | 'school_test'
  title:          string
  marks_obtained: number
  marks_total:    number
  sat_on:         string        // ISO date
  paper_ref:      string | null
  created_at:     string
  // derived client-side:
  percentage:     number        // marks_obtained / marks_total * 100
}

export interface GradeBoundary {
  grade:   string
  min_pct: number
  max_pct: number
}
```

---

## Proficiency Calculation

**Definition:** Rolling average of the last 5 assessments (past papers + school tests combined) for the subject, sorted by `sat_on` descending, normalized to %.

```typescript
function calcProficiency(assessments: Assessment[]): number | null {
  const last5 = [...assessments]
    .sort((a, b) => b.sat_on.localeCompare(a.sat_on))
    .slice(0, 5)
  if (last5.length === 0) return null
  const avg = last5.reduce((sum, a) => sum + a.percentage, 0) / last5.length
  return Math.round(avg * 10) / 10
}
```

**Grade derivation:** Compare proficiency % against the subject's grade boundaries (or defaults). The highest grade whose `min_pct` is met is the current grade.

---

## Routing

Two new routes added to the React Router config:

| Route | Component | Description |
|---|---|---|
| `/subjects` | `SubjectsIndexPage` | All subjects overview |
| `/subjects/:id` | `SubjectHubPage` | Single subject hub |

Navigation: `/subjects` is added to the main nav sidebar.

---

## `/subjects` — Index Page

**Header:** "Your Subjects" + `[✏️ Edit]` `[+ New subject]` buttons  
**Filter bar:** Label chips — "All" + one chip per distinct label. Filters the list.

**Subject rows** (one per subject):
- Color dot + subject name + exam board
- Label chips
- Proficiency bar + percentage
- Current grade (derived from boundaries)
- Gap to target grade (e.g. "−12% to A*" in red, "✓ target met" in green, "—" if no target or no scores)
- Mastery flame (from existing `subject_xp`)

**Edit mode** (toggled by ✏️ Edit button):
- Proficiency/grade columns hide
- Each row shows `[✏️ Edit]` `[🗑 Delete]` inline
- Edit → opens the subject edit form (name, color, exam board, target grade, labels)
- Delete → confirmation toast: "Delete [name]? This removes all scores and boundaries for this subject." with Cancel / Delete
- Button becomes `[✓ Done]` to exit edit mode

**Empty state:** "No subjects yet — add one to start tracking."

---

## `/subjects/:id` — Hub Page

### Header

- Color dot + subject name
- `exam_board` badge (purple) — hidden if not set
- `target_grade` badge (orange) — hidden if not set
- Label chips — inline, editable via `+` chip
- Mastery flame + tier label (top-right, from existing `subject_xp`)
- KPI row: total time studied · subject XP · session count (existing data)

### Tabs

#### Stats tab (default)

- **Proficiency card:** current % in large type, grade badge, trend direction (+N% from last 3), sparkline of all assessment scores over time (oldest → newest)
- **Recent scores list:** last 4 assessments, showing type badge (paper / school), title, date, percentage with color (≥75% green, 65–74% orange, <65% red)
- **Progress to target row:** "[current grade] → [target grade]", percentage bar, gap label. Hidden if no target grade set.

#### Past Papers tab

Shows assessment records of `type = 'past_paper'` for this subject. Independent of the `/past-papers` library page.

- `[+ Log past paper]` opens inline form: title, series/year, raw score, out of → saves to `assessments` with `type = 'past_paper'`
- Table of all logged past paper results: title · series · raw marks · max marks · % (auto-calculated + color bar) · grade
- Empty state: "No past paper results logged yet."

#### School Tests tab

- `[+ Log school test]` button
- Inline log form at top: title, date, score, out of → saves to `assessments` with `type = 'school_test'`
- List of all logged school tests below with type badge, title, date, percentage

#### Grade Boundaries tab

- Table of grade → % range, with "you are here" indicator on the current grade
- Editable inline — click a min/max value to edit
- "Reset to defaults" link
- Summary card: target grade, current %, gap

---

## Supabase Helpers (new)

```typescript
// src/lib/supabase.ts additions

fetchSubjectLabels(userId)           // all labels for user
createSubjectLabel(userId, name)
deleteSubjectLabel(labelId)
setSubjectLabels(subjectId, labelIds) // replace all mappings

fetchAssessments(userId, subjectId)  // ordered by sat_on desc
createAssessment(userId, assessment)
deleteAssessment(assessmentId)

fetchGradeBoundaries(userId, subjectId)
upsertGradeBoundaries(userId, subjectId, boundaries[])
```

---

## Store Changes

### `useSubjectStore`

Extend the existing `editSubject` action to accept all editable fields:

```typescript
// before: Partial<Pick<Subject, 'name' | 'color'>>
// after:
editSubject(id: string, updates: Partial<Pick<Subject, 'name' | 'color' | 'exam_board' | 'target_grade'>>): Promise<void>
```

All existing callers of `editSubject` continue to work unchanged since the new fields are optional.

### New `useAssessmentStore`

```typescript
interface AssessmentState {
  assessments: Assessment[]           // all loaded for current subject
  isLoading: boolean
  loadForSubject(subjectId: string): Promise<void>
  addAssessment(a: Omit<Assessment, 'id' | 'created_at' | 'percentage'>): Promise<void>
  removeAssessment(id: string): Promise<void>
  _reset(): void
}
```

### New `useSubjectLabelStore`

```typescript
interface SubjectLabelState {
  labels: SubjectLabel[]
  loadLabels(): Promise<void>
  createLabel(name: string): Promise<SubjectLabel | null>
  deleteLabel(id: string): Promise<void>
  setSubjectLabels(subjectId: string, labelIds: string[]): Promise<void>
  _reset(): void
}
```

---

## RLS Policies

All new tables require row-level security:

```sql
-- subject_labels
ALTER TABLE subject_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own labels"
  ON subject_labels FOR ALL USING (auth.uid() = user_id);

-- subject_label_map
ALTER TABLE subject_label_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own label maps"
  ON subject_label_map FOR ALL
  USING (EXISTS (
    SELECT 1 FROM subjects s WHERE s.id = subject_id AND s.user_id = auth.uid()
  ));

-- assessments
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own assessments"
  ON assessments FOR ALL USING (auth.uid() = user_id);

-- subject_grade_boundaries
ALTER TABLE subject_grade_boundaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own grade boundaries"
  ON subject_grade_boundaries FOR ALL USING (auth.uid() = user_id);
```

---

## Files to Create

| File | Purpose |
|---|---|
| `src/pages/SubjectsIndexPage.tsx` | `/subjects` route component |
| `src/pages/SubjectHubPage.tsx` | `/subjects/:id` route component |
| `src/store/useAssessmentStore.ts` | Assessment state + Supabase sync |
| `src/store/useSubjectLabelStore.ts` | Label state + Supabase sync |
| `src/components/subjects/SubjectCard.tsx` | Row component for index page |
| `src/components/subjects/ProficiencyChart.tsx` | Sparkline + score trend |
| `src/components/subjects/AssessmentForm.tsx` | Shared add-score form |
| `src/components/subjects/GradeBoundaryEditor.tsx` | Boundary config UI |
| `src/components/subjects/SubjectEditModal.tsx` | Edit form: name, color, exam board, target grade, labels |

## Files to Modify

| File | Change |
|---|---|
| `src/types/index.ts` | Add `Subject.exam_board`, `Subject.target_grade`, new `Assessment`, `SubjectLabel`, `GradeBoundary` types |
| `src/lib/supabase.ts` | Add assessment + label + boundary helpers |
| `src/store/useSubjectStore.ts` | Extend `editSubject` for new fields |
| `src/App.tsx` | Add `/subjects` and `/subjects/:id` routes |
| `src/components/Sidebar.tsx` | Add Subjects nav link |

---

## Non-goals

- Picker UX changes (deferred)
- Cross-subject proficiency comparison on `/stats` (deferred)
- Importing grade boundaries from official Edexcel/OCR data (manual entry only)
- Bulk import of past paper scores
