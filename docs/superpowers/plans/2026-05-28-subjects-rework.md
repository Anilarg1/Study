# Subjects Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make subjects first-class entities with exam board / target grade metadata, academic score tracking (past papers + school tests), configurable grade boundaries, and two new pages — `/subjects` index and `/subjects/:id` hub.

**Architecture:** Layered bottom-up — DB migrations → types → Supabase helpers → stores → components → pages → routing. Proficiency logic lives in a pure utility (`src/utils/proficiency.ts`) testable without React. Assessment and label stores are thin server-sync wrappers (no local persist). New pages lazy-loaded via `React.lazy`.

**Tech Stack:** React 18 + TypeScript (strict), Zustand, Supabase (Postgres + RLS), Vitest, React Router v6.

---

## File Map

**Create:**

| Path | Purpose |
|---|---|
| `src/utils/proficiency.ts` | Pure functions: `calcProficiency`, `deriveGrade`, `DEFAULT_BOUNDARIES` |
| `src/tests/proficiency.test.ts` | Unit tests for proficiency utils |
| `src/store/useAssessmentStore.ts` | Assessment state + Supabase sync |
| `src/store/useSubjectLabelStore.ts` | Label state + Supabase sync |
| `src/components/subjects/SubjectEditModal.tsx` | Create/edit form: name, color, exam board, target grade, labels |
| `src/components/subjects/SubjectCard.tsx` | Row component for index page |
| `src/components/subjects/ProficiencyChart.tsx` | SVG sparkline of all assessment scores |
| `src/components/subjects/AssessmentForm.tsx` | Inline add-score form (shared by past papers + school tests) |
| `src/components/subjects/GradeBoundaryEditor.tsx` | Editable boundary table |
| `src/pages/SubjectsIndexPage.tsx` | `/subjects` route |
| `src/pages/SubjectHubPage.tsx` | `/subjects/:id` route |

**Modify:**

| Path | Change |
|---|---|
| `src/types/index.ts` | Add `exam_board`, `target_grade` to `Subject`; add `SubjectLabel`, `Assessment`, `GradeBoundary` |
| `src/lib/supabase.ts` | Widen `patchSubject`; update `fetchSubjects` select; extend `createSubject`; add assessment / label / boundary helpers |
| `src/store/useSubjectStore.ts` | Widen `editSubject` signature; add optional opts to `addSubject` |
| `src/components/icons.tsx` | Add `IcBook` icon for Subjects nav |
| `src/App.tsx` | Add lazy imports + routes for `/subjects` and `/subjects/:id` |
| `src/components/Sidebar.tsx` | Add Subjects nav button |
| `src/styles/pages.css` | Add `.subjects-page` and `.subjects-hub-page` scoped CSS |

---

## Task 1: Database Migrations

**Files:**
- Apply via `mcp__claude_ai_Supabase__apply_migration`

- [ ] **Step 1: Alter subjects table**

Apply migration — name: `"add_exam_board_target_grade_to_subjects"`:
```sql
ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS exam_board   TEXT,
  ADD COLUMN IF NOT EXISTS target_grade TEXT;
```

- [ ] **Step 2: Create subject labels tables + RLS**

Apply migration — name: `"create_subject_labels"`:
```sql
CREATE TABLE IF NOT EXISTS subject_labels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subject_label_map (
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  label_id   UUID NOT NULL REFERENCES subject_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (subject_id, label_id)
);

ALTER TABLE subject_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own labels"
  ON subject_labels FOR ALL USING (auth.uid() = user_id);

ALTER TABLE subject_label_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own label maps"
  ON subject_label_map FOR ALL
  USING (EXISTS (
    SELECT 1 FROM subjects s WHERE s.id = subject_id AND s.user_id = auth.uid()
  ));
```

- [ ] **Step 3: Create assessments table + RLS**

Apply migration — name: `"create_assessments"`:
```sql
CREATE TABLE IF NOT EXISTS assessments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id     UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('past_paper', 'school_test')),
  title          TEXT NOT NULL,
  marks_obtained NUMERIC NOT NULL,
  marks_total    NUMERIC NOT NULL CHECK (marks_total > 0),
  sat_on         DATE NOT NULL,
  paper_ref      UUID REFERENCES past_papers(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own assessments"
  ON assessments FOR ALL USING (auth.uid() = user_id);
```

- [ ] **Step 4: Create grade boundaries table + RLS**

Apply migration — name: `"create_subject_grade_boundaries"`:
```sql
CREATE TABLE IF NOT EXISTS subject_grade_boundaries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  grade      TEXT NOT NULL,
  min_pct    NUMERIC NOT NULL,
  max_pct    NUMERIC NOT NULL,
  UNIQUE (user_id, subject_id, grade)
);

ALTER TABLE subject_grade_boundaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own grade boundaries"
  ON subject_grade_boundaries FOR ALL USING (auth.uid() = user_id);
```

- [ ] **Step 5: Verify migrations**

Run via `mcp__claude_ai_Supabase__execute_sql`:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'subjects' ORDER BY ordinal_position;
```
Confirm `exam_board` and `target_grade` appear. Then run `mcp__claude_ai_Supabase__list_tables` and confirm the four new tables exist.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: apply subjects rework DB migrations"
```

---

## Task 2: Types and Proficiency Utilities

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/utils/proficiency.ts`
- Create: `src/tests/proficiency.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/tests/proficiency.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { calcProficiency, deriveGrade, DEFAULT_BOUNDARIES } from '../utils/proficiency'
import type { Assessment } from '../types'

function mkA(overrides: Partial<Assessment> = {}): Assessment {
  return {
    id: 'a1', subject_id: 's1', type: 'past_paper',
    title: 'Test', marks_obtained: 70, marks_total: 100,
    sat_on: '2024-01-01', paper_ref: null, created_at: '2024-01-01T00:00:00Z',
    percentage: 70,
    ...overrides,
  }
}

describe('calcProficiency', () => {
  it('returns null for empty array', () => {
    expect(calcProficiency([])).toBeNull()
  })

  it('returns percentage for single assessment', () => {
    expect(calcProficiency([mkA({ percentage: 80 })])).toBe(80)
  })

  it('averages only the last 5 by sat_on desc', () => {
    const assessments = [
      mkA({ sat_on: '2024-01-06', percentage: 90 }),
      mkA({ sat_on: '2024-01-05', percentage: 80 }),
      mkA({ sat_on: '2024-01-04', percentage: 70 }),
      mkA({ sat_on: '2024-01-03', percentage: 60 }),
      mkA({ sat_on: '2024-01-02', percentage: 50 }),
      mkA({ sat_on: '2024-01-01', percentage: 10 }),  // ignored
    ]
    // (90+80+70+60+50)/5 = 70
    expect(calcProficiency(assessments)).toBe(70)
  })

  it('rounds to 1 decimal place', () => {
    const assessments = [
      mkA({ sat_on: '2024-01-02', percentage: 77 }),
      mkA({ sat_on: '2024-01-01', percentage: 80 }),
    ]
    expect(calcProficiency(assessments)).toBe(78.5)
  })
})

describe('deriveGrade', () => {
  it('returns A* at 90', () => {
    expect(deriveGrade(90, DEFAULT_BOUNDARIES)).toBe('A*')
  })

  it('returns A at 75', () => {
    expect(deriveGrade(75, DEFAULT_BOUNDARIES)).toBe('A')
  })

  it('returns B at 65', () => {
    expect(deriveGrade(65, DEFAULT_BOUNDARIES)).toBe('B')
  })

  it('returns null below lowest boundary', () => {
    expect(deriveGrade(10, DEFAULT_BOUNDARIES)).toBeNull()
  })

  it('uses custom boundaries', () => {
    const custom = [{ grade: 'Pass', min_pct: 50, max_pct: 100 }]
    expect(deriveGrade(60, custom)).toBe('Pass')
    expect(deriveGrade(40, custom)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/tests/proficiency.test.ts
```
Expected: FAIL — `Cannot find module '../utils/proficiency'`

- [ ] **Step 3: Update `src/types/index.ts`**

Find the `Subject` interface and add the two new nullable fields:
```typescript
export interface Subject {
  id:           string
  name:         string
  color:        string
  exam_board:   string | null   // new
  target_grade: string | null   // new
  created_at:   string
}
```

Then add three new interfaces after the last existing interface in the file:
```typescript
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
  sat_on:         string        // ISO date 'YYYY-MM-DD'
  paper_ref:      string | null
  created_at:     string
  percentage:     number        // derived client-side: marks_obtained / marks_total * 100
}

export interface GradeBoundary {
  grade:   string
  min_pct: number
  max_pct: number
}
```

- [ ] **Step 4: Create `src/utils/proficiency.ts`**

```typescript
import type { Assessment, GradeBoundary } from '../types'

export const DEFAULT_BOUNDARIES: GradeBoundary[] = [
  { grade: 'A*', min_pct: 90, max_pct: 100 },
  { grade: 'A',  min_pct: 75, max_pct: 90  },
  { grade: 'B',  min_pct: 65, max_pct: 75  },
  { grade: 'C',  min_pct: 55, max_pct: 65  },
  { grade: 'D',  min_pct: 45, max_pct: 55  },
  { grade: 'E',  min_pct: 35, max_pct: 45  },
]

export function calcProficiency(assessments: Assessment[]): number | null {
  const last5 = [...assessments]
    .sort((a, b) => b.sat_on.localeCompare(a.sat_on))
    .slice(0, 5)
  if (last5.length === 0) return null
  const avg = last5.reduce((sum, a) => sum + a.percentage, 0) / last5.length
  return Math.round(avg * 10) / 10
}

export function deriveGrade(pct: number, boundaries: GradeBoundary[]): string | null {
  const sorted = [...boundaries].sort((a, b) => b.min_pct - a.min_pct)
  for (const b of sorted) {
    if (pct >= b.min_pct) return b.grade
  }
  return null
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npx vitest run src/tests/proficiency.test.ts
```
Expected: 9 passing

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/utils/proficiency.ts src/tests/proficiency.test.ts
git commit -m "feat: add Subject metadata fields, Assessment/Label/GradeBoundary types, proficiency utils"
```

---

## Task 3: Supabase Helpers

**Files:**
- Modify: `src/lib/supabase.ts`

- [ ] **Step 1: Update import line**

In `src/lib/supabase.ts`, find the `import type` line (line 7) and add the new types:
```typescript
import type { Subject, Tag, SessionEntry, TimerMode, SubjectLabel, Assessment, GradeBoundary } from '../types'
```

- [ ] **Step 2: Update `fetchSubjects` to select new columns**

Replace the existing `fetchSubjects` function:
```typescript
export async function fetchSubjects(userId: string): Promise<{ data: Subject[], error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name, color, exam_board, target_grade, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  return { data: (data as Subject[]) ?? [], error }
}
```

- [ ] **Step 3: Update `createSubject` and `patchSubject`**

Replace the existing `createSubject`:
```typescript
export async function createSubject(
  userId: string,
  subject: { name: string; color: string; exam_board?: string | null; target_grade?: string | null },
): Promise<{ data: Subject | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('subjects')
    .insert({ user_id: userId, ...subject })
    .select()
    .single()
  return { data: data as Subject | null, error }
}
```

Replace the existing `patchSubject`:
```typescript
export async function patchSubject(
  subjectId: string,
  updates: Partial<Pick<Subject, 'name' | 'color' | 'exam_board' | 'target_grade'>>,
): Promise<PostgrestError | null> {
  const { error } = await supabase
    .from('subjects')
    .update(updates)
    .eq('id', subjectId)
  return error
}
```

- [ ] **Step 4: Add subject label helpers**

Append after the existing subjects section:
```typescript
// ─── Subject Labels helpers ───────────────────────────────────────────────────

export async function fetchSubjectLabels(
  userId: string,
): Promise<{ data: SubjectLabel[]; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('subject_labels')
    .select('id, name')
    .eq('user_id', userId)
    .order('name', { ascending: true })
  return { data: (data as SubjectLabel[]) ?? [], error }
}

export async function createSubjectLabel(
  userId: string,
  name: string,
): Promise<{ data: SubjectLabel | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('subject_labels')
    .insert({ user_id: userId, name })
    .select('id, name')
    .single()
  return { data: data as SubjectLabel | null, error }
}

export async function deleteSubjectLabel(labelId: string): Promise<PostgrestError | null> {
  const { error } = await supabase.from('subject_labels').delete().eq('id', labelId)
  return error
}

export async function fetchSubjectLabelMap(
  subjectIds: string[],
): Promise<{ data: { subject_id: string; label_id: string }[]; error: PostgrestError | null }> {
  if (subjectIds.length === 0) return { data: [], error: null }
  const { data, error } = await supabase
    .from('subject_label_map')
    .select('subject_id, label_id')
    .in('subject_id', subjectIds)
  return { data: (data ?? []) as { subject_id: string; label_id: string }[], error }
}

export async function setSubjectLabels(
  subjectId: string,
  labelIds: string[],
): Promise<PostgrestError | null> {
  const { error: delErr } = await supabase
    .from('subject_label_map')
    .delete()
    .eq('subject_id', subjectId)
  if (delErr) return delErr
  if (labelIds.length === 0) return null
  const { error: insErr } = await supabase
    .from('subject_label_map')
    .insert(labelIds.map(label_id => ({ subject_id: subjectId, label_id })))
  return insErr
}
```

- [ ] **Step 5: Add assessment helpers**

```typescript
// ─── Assessments helpers ──────────────────────────────────────────────────────

function withPercentage(rows: Omit<Assessment, 'percentage'>[]): Assessment[] {
  return rows.map(r => ({
    ...r,
    percentage: Math.round((r.marks_obtained / r.marks_total) * 1000) / 10,
  }))
}

const ASSESSMENT_COLS = 'id, subject_id, type, title, marks_obtained, marks_total, sat_on, paper_ref, created_at'

export async function fetchAssessments(
  userId: string,
  subjectId: string,
): Promise<{ data: Assessment[]; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('assessments')
    .select(ASSESSMENT_COLS)
    .eq('user_id', userId)
    .eq('subject_id', subjectId)
    .order('sat_on', { ascending: false })
  return { data: withPercentage((data ?? []) as Omit<Assessment, 'percentage'>[]), error }
}

export async function fetchAllAssessments(
  userId: string,
): Promise<{ data: Assessment[]; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('assessments')
    .select(ASSESSMENT_COLS)
    .eq('user_id', userId)
    .order('sat_on', { ascending: false })
  return { data: withPercentage((data ?? []) as Omit<Assessment, 'percentage'>[]), error }
}

export async function createAssessment(
  userId: string,
  a: Omit<Assessment, 'id' | 'created_at' | 'percentage'>,
): Promise<{ data: Assessment | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('assessments')
    .insert({
      user_id: userId,
      subject_id: a.subject_id,
      type: a.type,
      title: a.title,
      marks_obtained: a.marks_obtained,
      marks_total: a.marks_total,
      sat_on: a.sat_on,
      paper_ref: a.paper_ref ?? null,
    })
    .select(ASSESSMENT_COLS)
    .single()
  if (!data || error) return { data: null, error }
  return { data: withPercentage([data as Omit<Assessment, 'percentage'>])[0], error: null }
}

export async function deleteAssessment(id: string): Promise<PostgrestError | null> {
  const { error } = await supabase.from('assessments').delete().eq('id', id)
  return error
}
```

- [ ] **Step 6: Add grade boundary helpers**

```typescript
// ─── Grade Boundary helpers ───────────────────────────────────────────────────

export async function fetchGradeBoundaries(
  userId: string,
  subjectId: string,
): Promise<{ data: GradeBoundary[]; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('subject_grade_boundaries')
    .select('grade, min_pct, max_pct')
    .eq('user_id', userId)
    .eq('subject_id', subjectId)
    .order('min_pct', { ascending: false })
  return { data: (data as GradeBoundary[]) ?? [], error }
}

export async function upsertGradeBoundaries(
  userId: string,
  subjectId: string,
  boundaries: GradeBoundary[],
): Promise<PostgrestError | null> {
  const rows = boundaries.map(b => ({
    user_id: userId,
    subject_id: subjectId,
    grade: b.grade,
    min_pct: b.min_pct,
    max_pct: b.max_pct,
  }))
  const { error } = await supabase
    .from('subject_grade_boundaries')
    .upsert(rows, { onConflict: 'user_id,subject_id,grade' })
  return error
}
```

- [ ] **Step 7: Verify no type errors**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: add supabase helpers for assessments, labels, and grade boundaries"
```

---

## Task 4: Extend useSubjectStore

**Files:**
- Modify: `src/store/useSubjectStore.ts`

- [ ] **Step 1: Update SubjectState interface**

Find the `SubjectState` interface and update the two action signatures:
```typescript
addSubject(name: string, color: string, opts?: { exam_board?: string | null; target_grade?: string | null }): Promise<Subject | null>
editSubject(id: string, updates: Partial<Pick<Subject, 'name' | 'color' | 'exam_board' | 'target_grade'>>): Promise<void>
```

- [ ] **Step 2: Update `addSubject` implementation**

Replace the existing `addSubject` action body:
```typescript
async addSubject(name, color, opts) {
  const userId = getCurrentUserId()
  if (!userId) return null

  const { data, error } = await createSubject(userId, { name, color, ...opts })
  if (error || !data) { console.error(error); return null }

  set(state => ({ subjects: [...state.subjects, data] }))
  return data
},
```

The `editSubject` implementation (`await patchSubject(id, updates)`) does not need to change — `patchSubject` now accepts the wider type from Task 3.

- [ ] **Step 3: Verify no type errors**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/store/useSubjectStore.ts
git commit -m "feat: extend useSubjectStore editSubject and addSubject for new fields"
```

---

## Task 5: useSubjectLabelStore

**Files:**
- Create: `src/store/useSubjectLabelStore.ts`

- [ ] **Step 1: Create the store**

```typescript
import { create } from 'zustand'
import type { SubjectLabel } from '../types'
import { getCurrentUserId } from '../lib/currentUser'
import {
  fetchSubjectLabels,
  createSubjectLabel,
  deleteSubjectLabel as deleteSubjectLabelDB,
  fetchSubjectLabelMap,
  setSubjectLabels as setSubjectLabelsDB,
} from '../lib/supabase'

interface SubjectLabelState {
  labels:           SubjectLabel[]
  subjectLabelMap:  Record<string, string[]>  // subject_id → label_id[]
  isLoading:        boolean
  loadLabels():                                              Promise<void>
  loadSubjectLabelMap(subjectIds: string[]):                Promise<void>
  createLabel(name: string):                                Promise<SubjectLabel | null>
  deleteLabel(id: string):                                  Promise<void>
  setSubjectLabels(subjectId: string, labelIds: string[]): Promise<void>
  _reset():                                                  void
}

const useSubjectLabelStore = create<SubjectLabelState>()((set) => ({
  labels:          [],
  subjectLabelMap: {},
  isLoading:       false,

  async loadLabels() {
    const userId = getCurrentUserId()
    if (!userId) return
    set({ isLoading: true })
    const { data, error } = await fetchSubjectLabels(userId)
    if (error) { console.error(error); set({ isLoading: false }); return }
    set({ labels: data, isLoading: false })
  },

  async loadSubjectLabelMap(subjectIds) {
    const { data, error } = await fetchSubjectLabelMap(subjectIds)
    if (error) { console.error(error); return }
    const map: Record<string, string[]> = {}
    for (const { subject_id, label_id } of data) {
      if (!map[subject_id]) map[subject_id] = []
      map[subject_id].push(label_id)
    }
    set({ subjectLabelMap: map })
  },

  async createLabel(name) {
    const userId = getCurrentUserId()
    if (!userId) return null
    const { data, error } = await createSubjectLabel(userId, name)
    if (error || !data) { console.error(error); return null }
    set(s => ({ labels: [...s.labels, data] }))
    return data
  },

  async deleteLabel(id) {
    const error = await deleteSubjectLabelDB(id)
    if (error) { console.error(error); return }
    set(s => ({
      labels: s.labels.filter(l => l.id !== id),
      subjectLabelMap: Object.fromEntries(
        Object.entries(s.subjectLabelMap).map(([sid, ids]) => [sid, ids.filter(i => i !== id)])
      ),
    }))
  },

  async setSubjectLabels(subjectId, labelIds) {
    const error = await setSubjectLabelsDB(subjectId, labelIds)
    if (error) { console.error(error); return }
    set(s => ({ subjectLabelMap: { ...s.subjectLabelMap, [subjectId]: labelIds } }))
  },

  _reset() {
    set({ labels: [], subjectLabelMap: {}, isLoading: false })
  },
}))

export default useSubjectLabelStore
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/store/useSubjectLabelStore.ts
git commit -m "feat: add useSubjectLabelStore"
```

---

## Task 6: useAssessmentStore

**Files:**
- Create: `src/store/useAssessmentStore.ts`

- [ ] **Step 1: Create the store**

```typescript
import { create } from 'zustand'
import type { Assessment } from '../types'
import { getCurrentUserId } from '../lib/currentUser'
import {
  fetchAssessments,
  createAssessment as createAssessmentDB,
  deleteAssessment as deleteAssessmentDB,
} from '../lib/supabase'

interface AssessmentState {
  assessments:    Assessment[]
  isLoading:      boolean
  loadForSubject(subjectId: string):                                        Promise<void>
  addAssessment(a: Omit<Assessment, 'id' | 'created_at' | 'percentage'>): Promise<void>
  removeAssessment(id: string):                                             Promise<void>
  _reset():                                                                  void
}

const useAssessmentStore = create<AssessmentState>()((set) => ({
  assessments: [],
  isLoading:   false,

  async loadForSubject(subjectId) {
    const userId = getCurrentUserId()
    if (!userId) return
    set({ isLoading: true })
    const { data, error } = await fetchAssessments(userId, subjectId)
    if (error) { console.error(error); set({ isLoading: false }); return }
    set({ assessments: data, isLoading: false })
  },

  async addAssessment(a) {
    const userId = getCurrentUserId()
    if (!userId) return
    const { data, error } = await createAssessmentDB(userId, a)
    if (error || !data) { console.error(error); return }
    set(s => ({ assessments: [data, ...s.assessments] }))
  },

  async removeAssessment(id) {
    const error = await deleteAssessmentDB(id)
    if (error) { console.error(error); return }
    set(s => ({ assessments: s.assessments.filter(a => a.id !== id) }))
  },

  _reset() {
    set({ assessments: [], isLoading: false })
  },
}))

export default useAssessmentStore
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/store/useAssessmentStore.ts
git commit -m "feat: add useAssessmentStore"
```

---

## Task 7: SubjectEditModal

**Files:**
- Create: `src/components/subjects/SubjectEditModal.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState, useEffect } from 'react'
import type { Subject, SubjectLabel } from '../../types'
import useSubjectStore from '../../store/useSubjectStore'
import useSubjectLabelStore from '../../store/useSubjectLabelStore'
import { SUBJECT_COLORS } from '../../lib/subjects'

interface Props {
  subject: Subject | null   // null = create mode
  onClose(): void
}

export default function SubjectEditModal({ subject, onClose }: Props) {
  const addSubject   = useSubjectStore(s => s.addSubject)
  const editSubject  = useSubjectStore(s => s.editSubject)

  const labels             = useSubjectLabelStore(s => s.labels)
  const subjectLabelMap    = useSubjectLabelStore(s => s.subjectLabelMap)
  const loadLabels         = useSubjectLabelStore(s => s.loadLabels)
  const createLabel        = useSubjectLabelStore(s => s.createLabel)
  const setSubjectLabels   = useSubjectLabelStore(s => s.setSubjectLabels)

  const isCreate = subject === null

  const [name,          setName]          = useState(subject?.name ?? '')
  const [color,         setColor]         = useState(subject?.color ?? SUBJECT_COLORS[0] ?? '#8b85ff')
  const [examBoard,     setExamBoard]     = useState(subject?.exam_board ?? '')
  const [targetGrade,   setTargetGrade]   = useState(subject?.target_grade ?? '')
  const [selectedLabels, setSelectedLabels] = useState<string[]>(
    subject ? (subjectLabelMap[subject.id] ?? []) : []
  )
  const [newLabelName, setNewLabelName] = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  useEffect(() => { loadLabels() }, [loadLabels])

  function toggleLabel(id: string) {
    setSelectedLabels(prev =>
      prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]
    )
  }

  async function handleAddLabel() {
    const trimmed = newLabelName.trim()
    if (!trimmed) return
    const label = await createLabel(trimmed)
    if (label) {
      setSelectedLabels(prev => [...prev, label.id])
      setNewLabelName('')
    }
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('Subject name is required.'); return }
    setSubmitting(true)
    setError(null)

    const opts = {
      exam_board:   examBoard.trim()   || null,
      target_grade: targetGrade.trim() || null,
    }

    if (isCreate) {
      const s = await addSubject(name.trim(), color, opts)
      if (!s) { setError('Could not save — check your connection.'); setSubmitting(false); return }
      await setSubjectLabels(s.id, selectedLabels)
    } else {
      await editSubject(subject.id, { name: name.trim(), color, ...opts })
      await setSubjectLabels(subject.id, selectedLabels)
    }

    setSubmitting(false)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isCreate ? 'New subject' : 'Edit subject'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-row">
            <label className="form-label">Name</label>
            <input
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Physics"
              autoFocus
            />
          </div>

          <div className="form-row">
            <label className="form-label">Color</label>
            <div className="color-swatches">
              {SUBJECT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`color-swatch${color === c ? ' selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="form-row">
            <label className="form-label">
              Exam board <span className="form-optional">(optional)</span>
            </label>
            <input
              className="form-input"
              value={examBoard}
              onChange={e => setExamBoard(e.target.value)}
              placeholder="e.g. Edexcel IAL"
            />
          </div>

          <div className="form-row">
            <label className="form-label">
              Target grade <span className="form-optional">(optional)</span>
            </label>
            <input
              className="form-input"
              value={targetGrade}
              onChange={e => setTargetGrade(e.target.value)}
              placeholder="e.g. A*"
            />
          </div>

          <div className="form-row">
            <label className="form-label">Labels</label>
            <div className="label-chips">
              {labels.map((l: SubjectLabel) => (
                <button
                  key={l.id}
                  type="button"
                  className={`label-chip${selectedLabels.includes(l.id) ? ' selected' : ''}`}
                  onClick={() => toggleLabel(l.id)}
                >
                  {l.name}
                </button>
              ))}
              <div className="label-add-row">
                <input
                  className="form-input form-input-sm"
                  placeholder="New label…"
                  value={newLabelName}
                  onChange={e => setNewLabelName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddLabel()}
                />
                <button className="btn-ghost-sm" type="button" onClick={handleAddLabel}>
                  Add
                </button>
              </div>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : isCreate ? 'Create' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/subjects/SubjectEditModal.tsx
git commit -m "feat: add SubjectEditModal component"
```

---

## Task 8: SubjectCard

**Files:**
- Create: `src/components/subjects/SubjectCard.tsx`

- [ ] **Step 1: Create the component**

```tsx
import type { Subject, SubjectLabel, GradeBoundary } from '../../types'
import { getMasteryFromXP } from '../../utils/progression'
import { deriveGrade } from '../../utils/proficiency'

interface Props {
  subject:     Subject
  labels:      SubjectLabel[]
  proficiency: number | null
  boundaries:  GradeBoundary[]
  subjectXP:   number
  editMode:    boolean
  onEdit():    void
  onDelete():  void
}

const MASTERY_TIERS = ['Ember', 'Kindled', 'Burning', 'Blazing', 'Inferno']

function profColor(pct: number): string {
  if (pct >= 75) return '#4ade80'
  if (pct >= 65) return '#fbbf24'
  return '#ef4444'
}

function gapLabel(proficiency: number | null, targetGrade: string | null, boundaries: GradeBoundary[]): string {
  if (!proficiency || !targetGrade) return '—'
  const target = boundaries.find(b => b.grade === targetGrade)
  if (!target) return '—'
  const gap = target.min_pct - proficiency
  if (gap <= 0) return '✓ target met'
  return `−${gap.toFixed(1)}% to ${targetGrade}`
}

function gapColor(proficiency: number | null, targetGrade: string | null, boundaries: GradeBoundary[]): string {
  if (!proficiency || !targetGrade) return 'var(--text-mute)'
  const target = boundaries.find(b => b.grade === targetGrade)
  if (!target) return 'var(--text-mute)'
  return (target.min_pct - proficiency) <= 0 ? '#4ade80' : '#ef4444'
}

export default function SubjectCard({
  subject, labels, proficiency, boundaries, subjectXP, editMode, onEdit, onDelete,
}: Props) {
  const grade      = proficiency !== null ? deriveGrade(proficiency, boundaries) : null
  const mastery    = getMasteryFromXP(subjectXP)
  const masteryIdx = Math.max(0, MASTERY_TIERS.indexOf(mastery ?? 'Ember'))

  return (
    <div className={`s-card${editMode ? ' edit-mode' : ''}`}>
      <span className="s-dot" style={{ background: subject.color }} />

      <div className="s-identity">
        <span className="s-name">{subject.name}</span>
        {subject.exam_board && <span className="s-board">{subject.exam_board}</span>}
      </div>

      {labels.length > 0 && (
        <div className="s-labels">
          {labels.map(l => (
            <span key={l.id} className="s-label-chip">{l.name}</span>
          ))}
        </div>
      )}

      <div className="s-spacer" />

      {!editMode && (
        <>
          <div className="s-prof-wrap">
            {proficiency !== null ? (
              <>
                <div className="s-prof-bar-track">
                  <div
                    className="s-prof-bar-fill"
                    style={{ width: `${proficiency}%`, background: profColor(proficiency) }}
                  />
                </div>
                <span className="s-prof-pct" style={{ color: profColor(proficiency) }}>
                  {proficiency}%
                </span>
              </>
            ) : (
              <span className="s-no-prof">no scores yet</span>
            )}
          </div>

          <span
            className="s-grade"
            style={{ color: grade && proficiency !== null ? profColor(proficiency) : 'var(--text-faint)' }}
          >
            {grade ?? '—'}
          </span>

          <span className="s-target" style={{ color: gapColor(proficiency, subject.target_grade, boundaries) }}>
            {gapLabel(proficiency, subject.target_grade, boundaries)}
          </span>

          <span className="s-mastery" title={mastery ?? 'Ember'}>
            {'🔥'.repeat(Math.max(1, masteryIdx + 1)).slice(0, 1)}
          </span>
        </>
      )}

      {editMode && (
        <div className="s-actions">
          <button className="act-btn act-edit" onClick={onEdit}>Edit</button>
          <button className="act-btn act-del"  onClick={onDelete}>Delete</button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/subjects/SubjectCard.tsx
git commit -m "feat: add SubjectCard component"
```

---

## Task 9: SubjectsIndexPage

**Files:**
- Create: `src/pages/SubjectsIndexPage.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import useSubjectStore from '../store/useSubjectStore'
import useSubjectLabelStore from '../store/useSubjectLabelStore'
import useSubjectMasteryStore from '../store/useSubjectMasteryStore'
import { getCurrentUserId } from '../lib/currentUser'
import { fetchAllAssessments, fetchGradeBoundaries } from '../lib/supabase'
import { calcProficiency, DEFAULT_BOUNDARIES } from '../utils/proficiency'
import type { Subject, GradeBoundary } from '../types'
import SubjectCard from '../components/subjects/SubjectCard'
import SubjectEditModal from '../components/subjects/SubjectEditModal'

export default function SubjectsIndexPage() {
  const navigate      = useNavigate()
  const subjects      = useSubjectStore(s => s.subjects)
  const deleteSubject = useSubjectStore(s => s.deleteSubject)
  const subjectXP     = useSubjectMasteryStore(s => s.subjectXP)

  const labels              = useSubjectLabelStore(s => s.labels)
  const subjectLabelMap     = useSubjectLabelStore(s => s.subjectLabelMap)
  const loadLabels          = useSubjectLabelStore(s => s.loadLabels)
  const loadSubjectLabelMap = useSubjectLabelStore(s => s.loadSubjectLabelMap)

  const [proficiencyMap, setProficiencyMap] = useState<Record<string, number | null>>({})
  const [boundaryMap,    setBoundaryMap]    = useState<Record<string, GradeBoundary[]>>({})
  const [editMode,       setEditMode]       = useState(false)
  const [filterLabelId,  setFilterLabelId]  = useState<string | null>(null)
  const [modalSubject,   setModalSubject]   = useState<'new' | string | null>(null)
  const [deleteTarget,   setDeleteTarget]   = useState<string | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')

  useEffect(() => { loadLabels() }, [loadLabels])

  useEffect(() => {
    if (subjects.length > 0) {
      loadSubjectLabelMap(subjects.map(s => s.id))
    }
  }, [subjects, loadSubjectLabelMap])

  useEffect(() => {
    const userId = getCurrentUserId()
    if (!userId || subjects.length === 0) return

    fetchAllAssessments(userId).then(({ data }) => {
      const map: Record<string, number | null> = {}
      for (const s of subjects) {
        map[s.id] = calcProficiency(data.filter(a => a.subject_id === s.id))
      }
      setProficiencyMap(map)
    })

    Promise.all(
      subjects.map(s =>
        fetchGradeBoundaries(userId, s.id).then(({ data }) => ({
          id: s.id,
          boundaries: data.length > 0 ? data : DEFAULT_BOUNDARIES,
        }))
      )
    ).then(results => {
      const map: Record<string, GradeBoundary[]> = {}
      for (const { id, boundaries } of results) map[id] = boundaries
      setBoundaryMap(map)
    })
  }, [subjects])

  const filteredSubjects = useMemo(() => {
    if (!filterLabelId) return subjects
    return subjects.filter(s => (subjectLabelMap[s.id] ?? []).includes(filterLabelId))
  }, [subjects, subjectLabelMap, filterLabelId])

  const editingSubject: Subject | null = modalSubject && modalSubject !== 'new'
    ? subjects.find(s => s.id === modalSubject) ?? null
    : null

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    deleteSubject(deleteTarget)
    setDeleteTarget(null)
    setDeleteConfirmName('')
  }

  return (
    <div className="subjects-page">
      <div className="subjects-header">
        <h1 className="subjects-title">Your Subjects</h1>
        <div className="subjects-header-actions">
          <button
            className={`btn-edit-mode${editMode ? ' active' : ''}`}
            onClick={() => setEditMode(m => !m)}
          >
            {editMode ? '✓ Done' : 'Edit'}
          </button>
          <button className="btn-new-subject" onClick={() => setModalSubject('new')}>
            + New subject
          </button>
        </div>
      </div>

      {labels.length > 0 && (
        <div className="subjects-filter-bar">
          <button
            className={`filter-chip${!filterLabelId ? ' active' : ''}`}
            onClick={() => setFilterLabelId(null)}
          >
            All
          </button>
          {labels.map(l => (
            <button
              key={l.id}
              className={`filter-chip${filterLabelId === l.id ? ' active' : ''}`}
              onClick={() => setFilterLabelId(filterLabelId === l.id ? null : l.id)}
            >
              {l.name}
            </button>
          ))}
        </div>
      )}

      {!editMode && filteredSubjects.length > 0 && (
        <div className="s-col-header">
          <div style={{ width: 11 }} />
          <div style={{ minWidth: 100 }}>Subject</div>
          <div style={{ flex: 1 }} />
          <div style={{ minWidth: 200 }}>Proficiency</div>
          <div style={{ minWidth: 24, textAlign: 'center' }}>Grade</div>
          <div style={{ minWidth: 100, textAlign: 'right' }}>vs Target</div>
          <div style={{ width: 18 }} />
        </div>
      )}

      {filteredSubjects.length === 0 ? (
        <p className="subjects-empty">No subjects yet — add one to start tracking.</p>
      ) : (
        filteredSubjects.map(s => {
          const subjectLabels = (subjectLabelMap[s.id] ?? [])
            .map(id => labels.find(l => l.id === id))
            .filter((l): l is NonNullable<typeof l> => l !== undefined)
          return (
            <SubjectCard
              key={s.id}
              subject={s}
              labels={subjectLabels}
              proficiency={proficiencyMap[s.id] ?? null}
              boundaries={boundaryMap[s.id] ?? DEFAULT_BOUNDARIES}
              subjectXP={subjectXP[s.id] ?? 0}
              editMode={editMode}
              onEdit={() => setModalSubject(s.id)}
              onDelete={() => {
                setDeleteTarget(s.id)
                setDeleteConfirmName(s.name)
              }}
            />
          )
        })
      )}

      {/* Clicking a card in non-edit mode navigates to hub */}
      {/* Note: the click handler is in SubjectCard — add an onClick prop in Task 8 if desired */}

      {modalSubject !== null && (
        <SubjectEditModal
          subject={modalSubject === 'new' ? null : editingSubject}
          onClose={() => setModalSubject(null)}
        />
      )}

      {deleteTarget && (
        <div className="confirm-toast show">
          <span>Delete <strong>{deleteConfirmName}</strong>?</span>
          <span className="confirm-sub">Removes all scores and boundaries for this subject.</span>
          <button className="toast-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="toast-delete" onClick={handleDeleteConfirm}>Delete</button>
        </div>
      )}
    </div>
  )
}
```

**Note:** Add an `onClick` prop to `SubjectCard` for navigation (non-edit mode). Update the `Props` interface in `SubjectCard.tsx` to add `onClick?(): void` and wire it to the card's `onClick` in non-edit mode:
```tsx
// In SubjectCard, add to Props:
onClick?(): void

// Update .s-card div:
<div
  className={`s-card${editMode ? ' edit-mode' : ''}`}
  onClick={!editMode ? onClick : undefined}
  style={{ cursor: editMode ? 'default' : 'pointer' }}
>
```

Then in `SubjectsIndexPage`, pass `onClick={() => navigate(`/subjects/${s.id}`)}` to each `SubjectCard`.

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/pages/SubjectsIndexPage.tsx src/components/subjects/SubjectCard.tsx
git commit -m "feat: add SubjectsIndexPage with card navigation"
```

---

## Task 10: ProficiencyChart + SubjectHubPage

**Files:**
- Create: `src/components/subjects/ProficiencyChart.tsx`
- Create: `src/pages/SubjectHubPage.tsx`

- [ ] **Step 1: Create ProficiencyChart**

```tsx
import type { Assessment } from '../../types'

interface Props {
  assessments: Assessment[]
}

const W = 200
const H = 48
const PAD = 4

export default function ProficiencyChart({ assessments }: Props) {
  const sorted = [...assessments].sort((a, b) => a.sat_on.localeCompare(b.sat_on))
  if (sorted.length < 2) return null

  const pcts  = sorted.map(a => a.percentage)
  const minP  = Math.min(...pcts)
  const maxP  = Math.max(...pcts)
  const range = maxP - minP || 1

  const xAt = (i: number) => PAD + (i / (pcts.length - 1)) * (W - PAD * 2)
  const yAt = (p: number) => H - PAD - ((p - minP) / range) * (H - PAD * 2)

  const points = pcts.map((p, i) => `${xAt(i)},${yAt(p)}`).join(' ')
  const lastX = xAt(pcts.length - 1)
  const lastY = yAt(pcts[pcts.length - 1])

  const compareFrom = pcts.length >= 3 ? pcts[pcts.length - 3] : pcts[0]
  const trend = pcts[pcts.length - 1] - compareFrom

  return (
    <div className="prof-chart">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.5"
        />
        <circle cx={lastX} cy={lastY} r="3" fill="var(--accent)" />
      </svg>
      {trend !== 0 && (
        <span
          className="prof-trend"
          style={{ color: trend >= 0 ? '#4ade80' : '#ef4444' }}
        >
          {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create SubjectHubPage**

```tsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useSubjectStore from '../store/useSubjectStore'
import useSubjectMasteryStore from '../store/useSubjectMasteryStore'
import useAssessmentStore from '../store/useAssessmentStore'
import useSubjectLabelStore from '../store/useSubjectLabelStore'
import { getCurrentUserId } from '../lib/currentUser'
import { fetchGradeBoundaries, upsertGradeBoundaries } from '../lib/supabase'
import { calcProficiency, deriveGrade, DEFAULT_BOUNDARIES } from '../utils/proficiency'
import type { GradeBoundary } from '../types'
import ProficiencyChart from '../components/subjects/ProficiencyChart'
import AssessmentForm from '../components/subjects/AssessmentForm'
import GradeBoundaryEditor from '../components/subjects/GradeBoundaryEditor'

type Tab = 'stats' | 'past-papers' | 'school-tests' | 'grade-boundaries'

const TAB_LABELS: Record<Tab, string> = {
  'stats': 'Stats',
  'past-papers': 'Past Papers',
  'school-tests': 'School Tests',
  'grade-boundaries': 'Grade Boundaries',
}

function pctColor(pct: number): string {
  if (pct >= 75) return '#4ade80'
  if (pct >= 65) return '#fbbf24'
  return '#ef4444'
}

export default function SubjectHubPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const subject    = useSubjectStore(s => s.subjects.find(x => x.id === id))
  const subjectXP  = useSubjectMasteryStore(s => s.subjectXP)

  const assessments      = useAssessmentStore(s => s.assessments)
  const isLoadingA       = useAssessmentStore(s => s.isLoading)
  const loadForSubject   = useAssessmentStore(s => s.loadForSubject)
  const removeAssessment = useAssessmentStore(s => s.removeAssessment)

  const labels              = useSubjectLabelStore(s => s.labels)
  const subjectLabelMap     = useSubjectLabelStore(s => s.subjectLabelMap)
  const loadLabels          = useSubjectLabelStore(s => s.loadLabels)
  const loadSubjectLabelMap = useSubjectLabelStore(s => s.loadSubjectLabelMap)

  const [tab,        setTab]        = useState<Tab>('stats')
  const [boundaries, setBoundaries] = useState<GradeBoundary[]>(DEFAULT_BOUNDARIES)

  useEffect(() => {
    if (!id) return
    loadForSubject(id)
    loadLabels()
    loadSubjectLabelMap([id])
    const userId = getCurrentUserId()
    if (!userId) return
    fetchGradeBoundaries(userId, id).then(({ data }) => {
      setBoundaries(data.length > 0 ? data : DEFAULT_BOUNDARIES)
    })
  }, [id, loadForSubject, loadLabels, loadSubjectLabelMap])

  if (!subject) {
    return (
      <div className="subjects-hub-page">
        <button className="hub-back" onClick={() => navigate('/subjects')}>← Subjects</button>
        <p className="subjects-empty">Subject not found.</p>
      </div>
    )
  }

  const proficiency  = calcProficiency(assessments)
  const grade        = proficiency !== null ? deriveGrade(proficiency, boundaries) : null
  const subjectLabels = (subjectLabelMap[subject.id] ?? [])
    .map(lid => labels.find(l => l.id === lid))
    .filter((l): l is NonNullable<typeof l> => l !== undefined)

  const pastPapers  = assessments.filter(a => a.type === 'past_paper')
  const schoolTests = assessments.filter(a => a.type === 'school_test')
  const recent4     = assessments.slice(0, 4)
  const xp          = subjectXP[subject.id] ?? 0

  async function handleSaveBoundaries(updated: GradeBoundary[]) {
    const userId = getCurrentUserId()
    if (!userId || !id) return
    const error = await upsertGradeBoundaries(userId, id, updated)
    if (!error) setBoundaries(updated)
  }

  async function handleResetBoundaries() {
    const userId = getCurrentUserId()
    if (!userId || !id) return
    await upsertGradeBoundaries(userId, id, DEFAULT_BOUNDARIES)
    setBoundaries(DEFAULT_BOUNDARIES)
  }

  return (
    <div className="subjects-hub-page">
      {/* Header */}
      <div className="hub-header">
        <button className="hub-back" onClick={() => navigate('/subjects')}>← Subjects</button>

        <div className="hub-title-row">
          <span className="hub-dot" style={{ background: subject.color }} />
          <h1 className="hub-name">{subject.name}</h1>
          {subject.exam_board && (
            <span className="hub-badge hub-badge-purple">{subject.exam_board}</span>
          )}
          {subject.target_grade && (
            <span className="hub-badge hub-badge-orange">Target: {subject.target_grade}</span>
          )}
        </div>

        {subjectLabels.length > 0 && (
          <div className="hub-label-row">
            {subjectLabels.map(l => (
              <span key={l.id} className="s-label-chip">{l.name}</span>
            ))}
          </div>
        )}

        <div className="hub-kpi-row">
          <div className="hub-kpi">
            <span className="hub-kpi-val">{xp.toLocaleString()}</span>
            <span className="hub-kpi-lbl">XP</span>
          </div>
          <div className="hub-kpi">
            <span className="hub-kpi-val">{assessments.length}</span>
            <span className="hub-kpi-lbl">Assessments</span>
          </div>
        </div>
      </div>

      {/* Tab strip */}
      <div className="hub-tabs">
        {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
          <button
            key={t}
            className={`hub-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Stats tab */}
      {tab === 'stats' && (
        <div className="hub-tab-content">
          <div className="prof-card">
            <div className="prof-card-left">
              <span
                className="prof-big"
                style={{ color: proficiency !== null ? pctColor(proficiency) : 'var(--text-faint)' }}
              >
                {proficiency !== null ? `${proficiency}%` : '—'}
              </span>
              {grade && <span className="grade-badge">{grade}</span>}
              <ProficiencyChart assessments={assessments} />
            </div>
          </div>

          {recent4.length > 0 && (
            <div className="hub-section">
              <h3 className="hub-section-title">Recent Scores</h3>
              {recent4.map(a => (
                <div key={a.id} className="score-row">
                  <span className={`score-type-badge score-type-${a.type}`}>
                    {a.type === 'past_paper' ? 'paper' : 'school'}
                  </span>
                  <span className="score-title">{a.title}</span>
                  <span className="score-date">{a.sat_on}</span>
                  <span className="score-pct" style={{ color: pctColor(a.percentage) }}>
                    {a.percentage}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {(() => {
            if (!subject.target_grade || proficiency === null) return null
            const target = boundaries.find(b => b.grade === subject.target_grade)
            if (!target) return null
            const gap    = target.min_pct - proficiency
            const barPct = Math.min(100, (proficiency / target.min_pct) * 100)
            return (
              <div className="hub-section">
                <h3 className="hub-section-title">Progress to Target</h3>
                <div className="progress-row">
                  <span className="progress-grade">{grade ?? '—'}</span>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${barPct}%` }} />
                  </div>
                  <span className="progress-grade">{subject.target_grade}</span>
                </div>
                <p className="progress-gap" style={{ color: gap <= 0 ? '#4ade80' : '#ef4444' }}>
                  {gap <= 0 ? '✓ Target met' : `${gap.toFixed(1)}% to go`}
                </p>
              </div>
            )
          })()}

          {assessments.length === 0 && !isLoadingA && (
            <p className="subjects-empty">
              No assessments yet — log one in Past Papers or School Tests.
            </p>
          )}
        </div>
      )}

      {/* Past Papers tab */}
      {tab === 'past-papers' && id && (
        <div className="hub-tab-content">
          <AssessmentForm subjectId={id} type="past_paper" />
          {pastPapers.length === 0 ? (
            <p className="subjects-empty">No past paper results logged yet.</p>
          ) : (
            <table className="assessment-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Date</th>
                  <th>Marks</th>
                  <th>%</th>
                  <th>Grade</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pastPapers.map(a => (
                  <tr key={a.id}>
                    <td>{a.title}</td>
                    <td>{a.sat_on}</td>
                    <td>{a.marks_obtained}/{a.marks_total}</td>
                    <td style={{ color: pctColor(a.percentage) }}>{a.percentage}%</td>
                    <td>{deriveGrade(a.percentage, boundaries) ?? '—'}</td>
                    <td>
                      <button className="act-del-sm" onClick={() => removeAssessment(a.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* School Tests tab */}
      {tab === 'school-tests' && id && (
        <div className="hub-tab-content">
          <AssessmentForm subjectId={id} type="school_test" />
          {schoolTests.length === 0 ? (
            <p className="subjects-empty">No school test scores logged yet.</p>
          ) : (
            <div className="score-list">
              {schoolTests.map(a => (
                <div key={a.id} className="score-row">
                  <span className="score-type-badge score-type-school_test">school</span>
                  <span className="score-title">{a.title}</span>
                  <span className="score-date">{a.sat_on}</span>
                  <span className="score-pct" style={{ color: pctColor(a.percentage) }}>
                    {a.percentage}%
                  </span>
                  <button className="act-del-sm" onClick={() => removeAssessment(a.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grade Boundaries tab */}
      {tab === 'grade-boundaries' && (
        <div className="hub-tab-content">
          <GradeBoundaryEditor
            boundaries={boundaries}
            currentPct={proficiency}
            onSave={handleSaveBoundaries}
            onReset={handleResetBoundaries}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify no type errors**

```bash
npx tsc --noEmit
```
Expected: errors only for missing `AssessmentForm` and `GradeBoundaryEditor` imports — resolved in the next two tasks.

- [ ] **Step 4: Commit**

```bash
git add src/components/subjects/ProficiencyChart.tsx src/pages/SubjectHubPage.tsx
git commit -m "feat: add ProficiencyChart and SubjectHubPage"
```

---

## Task 11: AssessmentForm

**Files:**
- Create: `src/components/subjects/AssessmentForm.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from 'react'
import useAssessmentStore from '../../store/useAssessmentStore'
import type { Assessment } from '../../types'

interface Props {
  subjectId: string
  type:      'past_paper' | 'school_test'
}

const LOG_LABEL: Record<Props['type'], string> = {
  past_paper:  'Log Past Paper',
  school_test: 'Log School Test',
}
const TITLE_PLACEHOLDER: Record<Props['type'], string> = {
  past_paper:  'e.g. 2024 Jan — Unit 4',
  school_test: 'e.g. Mock Exam 2',
}

export default function AssessmentForm({ subjectId, type }: Props) {
  const addAssessment = useAssessmentStore(s => s.addAssessment)

  const [open,     setOpen]     = useState(false)
  const [title,    setTitle]    = useState('')
  const [obtained, setObtained] = useState('')
  const [total,    setTotal]    = useState('')
  const [satOn,    setSatOn]    = useState(new Date().toISOString().slice(0, 10))
  const [error,    setError]    = useState<string | null>(null)
  const [saving,   setSaving]   = useState(false)

  function reset() {
    setTitle(''); setObtained(''); setTotal('')
    setSatOn(new Date().toISOString().slice(0, 10))
    setError(null)
    setOpen(false)
  }

  async function handleSubmit() {
    if (!title.trim()) { setError('Title is required.'); return }
    const oNum = parseFloat(obtained)
    const tNum = parseFloat(total)
    if (isNaN(oNum) || isNaN(tNum)) { setError('Marks must be numbers.'); return }
    if (tNum <= 0)                   { setError('Total marks must be greater than 0.'); return }
    if (oNum < 0)                    { setError('Marks obtained cannot be negative.'); return }

    setSaving(true)
    setError(null)
    const a: Omit<Assessment, 'id' | 'created_at' | 'percentage'> = {
      subject_id: subjectId,
      type,
      title: title.trim(),
      marks_obtained: oNum,
      marks_total: tNum,
      sat_on: satOn,
      paper_ref: null,
    }
    await addAssessment(a)
    setSaving(false)
    reset()
  }

  if (!open) {
    return (
      <div className="assessment-form-wrap">
        <button className="btn-log-assessment" onClick={() => setOpen(true)}>
          + {LOG_LABEL[type]}
        </button>
      </div>
    )
  }

  return (
    <div className="assessment-form-wrap">
      <div className="assessment-form">
        <div className="form-row">
          <label className="form-label">Title</label>
          <input
            className="form-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={TITLE_PLACEHOLDER[type]}
            autoFocus
          />
        </div>
        <div className="form-row form-row-inline">
          <div>
            <label className="form-label">Marks</label>
            <input
              className="form-input form-input-sm"
              type="number" min="0"
              value={obtained}
              onChange={e => setObtained(e.target.value)}
              placeholder="e.g. 72"
            />
          </div>
          <span className="form-divider">/ out of</span>
          <div>
            <label className="form-label">&nbsp;</label>
            <input
              className="form-input form-input-sm"
              type="number" min="1"
              value={total}
              onChange={e => setTotal(e.target.value)}
              placeholder="e.g. 90"
            />
          </div>
          <div>
            <label className="form-label">Date</label>
            <input
              className="form-input form-input-sm"
              type="date"
              value={satOn}
              onChange={e => setSatOn(e.target.value)}
            />
          </div>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button className="btn-secondary" onClick={reset} disabled={saving}>Cancel</button>
          <button className="btn-primary"   onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/subjects/AssessmentForm.tsx
git commit -m "feat: add AssessmentForm component"
```

---

## Task 12: GradeBoundaryEditor

**Files:**
- Create: `src/components/subjects/GradeBoundaryEditor.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from 'react'
import type { GradeBoundary } from '../../types'
import { deriveGrade } from '../../utils/proficiency'

interface Props {
  boundaries: GradeBoundary[]
  currentPct: number | null
  onSave(updated: GradeBoundary[]): Promise<void>
  onReset(): Promise<void>
}

export default function GradeBoundaryEditor({ boundaries, currentPct, onSave, onReset }: Props) {
  const [editing, setEditing] = useState<GradeBoundary[]>(boundaries)
  const [saving,  setSaving]  = useState(false)

  const sortedEditing = [...editing].sort((a, b) => b.min_pct - a.min_pct)
  const currentGrade  = currentPct !== null ? deriveGrade(currentPct, editing) : null

  function updateField(grade: string, field: 'min_pct' | 'max_pct', val: string) {
    const num = parseFloat(val)
    if (isNaN(num)) return
    setEditing(prev => prev.map(b => b.grade === grade ? { ...b, [field]: num } : b))
  }

  async function handleSave() {
    setSaving(true)
    await onSave(editing)
    setSaving(false)
  }

  async function handleReset() {
    setSaving(true)
    await onReset()
    setSaving(false)
  }

  return (
    <div className="boundary-editor">
      <table className="boundary-table">
        <thead>
          <tr>
            <th>Grade</th>
            <th>Min %</th>
            <th>Max %</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sortedEditing.map(b => (
            <tr key={b.grade} className={currentGrade === b.grade ? 'boundary-row-current' : ''}>
              <td className="boundary-grade">{b.grade}</td>
              <td>
                <input
                  className="form-input form-input-sm"
                  type="number" min="0" max="100"
                  value={b.min_pct}
                  onChange={e => updateField(b.grade, 'min_pct', e.target.value)}
                />
              </td>
              <td>
                <input
                  className="form-input form-input-sm"
                  type="number" min="0" max="100"
                  value={b.max_pct}
                  onChange={e => updateField(b.grade, 'max_pct', e.target.value)}
                />
              </td>
              <td>
                {currentGrade === b.grade && (
                  <span className="boundary-you-here">← you are here</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {currentPct !== null && (
        <div className="boundary-summary">
          Your score: <strong>{currentPct}%</strong>
          {currentGrade && <> · Current grade: <strong>{currentGrade}</strong></>}
        </div>
      )}

      <div className="form-actions">
        <button className="btn-ghost" onClick={handleReset} disabled={saving}>
          Reset to defaults
        </button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save boundaries'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/subjects/GradeBoundaryEditor.tsx
git commit -m "feat: add GradeBoundaryEditor component"
```

---

## Task 13: Routing, Nav, and CSS

**Files:**
- Modify: `src/components/icons.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/styles/pages.css`

- [ ] **Step 1: Add IcBook to icons.tsx**

Append to `src/components/icons.tsx`:
```tsx
export function IcBook({ size = 16, className = 'ni-icon' }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}
```

- [ ] **Step 2: Add lazy imports to App.tsx**

After the last existing `lazy()` line (currently `PastPapersPage`), add:
```typescript
const SubjectsIndexPage = lazy(() => import('./pages/SubjectsIndexPage'))
const SubjectHubPage    = lazy(() => import('./pages/SubjectHubPage'))
```

Inside the `<Routes>` block after the `/past-papers` route, add:
```tsx
<Route path="/subjects"     element={<SubjectsIndexPage />} />
<Route path="/subjects/:id" element={<SubjectHubPage />} />
```

- [ ] **Step 3: Add Subjects nav button to Sidebar.tsx**

Update the icons import in `Sidebar.tsx` to include `IcBook`:
```typescript
import {
  IcTimer, IcStreak, IcToday, IcStats, IcTimetable, IcNotes,
  IcFlash, IcPlus, IcSignOut, IcChevron, IcGear as IcSettings, IcBook,
} from './icons'
```

Add a Subjects button after the Stats button (the button with `onClick={() => go('/stats')}`):
```tsx
<button
  className={`nav-item${location.pathname.startsWith('/subjects') ? ' active' : ''}`}
  title="Subjects"
  onClick={() => go('/subjects')}
>
  <IcBook />
</button>
```

- [ ] **Step 4: Add CSS to pages.css**

Append the following to `src/styles/pages.css`:
```css
/* ── /subjects pages ─────────────────────────────────────────────────────── */

.subjects-page,
.subjects-hub-page {
  padding: 28px 32px;
  max-width: 900px;
}

.subjects-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.subjects-title { font-size: 20px; font-weight: 700; color: var(--text); }
.subjects-header-actions { display: flex; gap: 8px; }

.subjects-filter-bar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.filter-chip {
  font-size: 11px; padding: 3px 10px; border-radius: 20px;
  cursor: pointer; border: 1px solid var(--hairline);
  color: var(--text-mute); background: var(--surface); transition: all 0.12s;
}
.filter-chip.active {
  color: var(--accent);
  border-color: color-mix(in oklab, var(--accent) 36%, transparent);
  background: color-mix(in oklab, var(--accent) 8%, transparent);
}
.filter-chip:hover:not(.active) { border-color: var(--hairline-2); color: var(--text-dim); }

.s-card {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 18px; background: var(--surface);
  border: 1px solid var(--hairline); border-radius: 10px;
  margin-bottom: 8px; cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}
.s-card:not(.edit-mode):hover { border-color: var(--hairline-2); background: var(--surface-2); }
.s-card.edit-mode { cursor: default; border-color: var(--hairline-2); }
.s-dot { width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; }
.s-identity { display: flex; flex-direction: column; min-width: 100px; }
.s-name { font-size: 14px; font-weight: 600; color: var(--text); }
.s-board { font-size: 10px; color: var(--text-mute); }
.s-labels { display: flex; gap: 4px; flex-wrap: wrap; flex: 0 0 auto; }
.s-label-chip {
  font-size: 9.5px; padding: 1px 7px; border-radius: 20px;
  border: 1px solid var(--hairline); color: var(--text-mute); background: var(--surface-2);
}
.s-spacer { flex: 1; min-width: 0; }
.s-prof-wrap { display: flex; align-items: center; gap: 10px; min-width: 200px; }
.s-prof-bar-track { flex: 1; height: 5px; background: var(--surface-3); border-radius: 3px; overflow: hidden; }
.s-prof-bar-fill { height: 100%; border-radius: 3px; }
.s-prof-pct { font-size: 12px; font-weight: 600; min-width: 36px; text-align: right; font-variant-numeric: tabular-nums; }
.s-grade { font-size: 11px; font-weight: 700; min-width: 24px; text-align: center; }
.s-target { font-size: 10.5px; flex-shrink: 0; min-width: 100px; text-align: right; }
.s-mastery { font-size: 14px; flex-shrink: 0; }
.s-no-prof { font-size: 11px; color: var(--text-faint); font-style: italic; }
.s-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.s-col-header {
  display: flex; align-items: center; gap: 14px;
  font-size: 9.5px; color: var(--text-faint);
  text-transform: uppercase; letter-spacing: 0.05em;
  padding: 0 18px 6px;
}

.act-btn {
  display: flex; align-items: center; gap: 5px;
  font-size: 11.5px; padding: 5px 11px; border-radius: 6px;
  cursor: pointer; border: 1px solid; font-family: inherit; transition: background 0.1s;
}
.act-edit {
  color: var(--accent);
  border-color: color-mix(in oklab, var(--accent) 35%, transparent);
  background: color-mix(in oklab, var(--accent) 8%, transparent);
}
.act-edit:hover { background: color-mix(in oklab, var(--accent) 15%, transparent); }
.act-del {
  color: #ef4444;
  border-color: color-mix(in oklab, #ef4444 35%, transparent);
  background: color-mix(in oklab, #ef4444 8%, transparent);
}
.act-del:hover { background: color-mix(in oklab, #ef4444 15%, transparent); }
.act-del-sm {
  color: var(--text-faint); background: none; border: none;
  cursor: pointer; font-size: 12px; padding: 2px 6px; border-radius: 4px;
}
.act-del-sm:hover { color: #ef4444; background: color-mix(in oklab, #ef4444 8%, transparent); }

.btn-new-subject,
.btn-edit-mode {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11.5px; border-radius: 6px; padding: 5px 12px;
  cursor: pointer; font-family: inherit;
}
.btn-new-subject {
  color: var(--accent);
  border: 1px solid color-mix(in oklab, var(--accent) 30%, transparent);
  background: color-mix(in oklab, var(--accent) 8%, transparent);
}
.btn-edit-mode {
  color: var(--text-mute); border: 1px solid var(--hairline); background: var(--surface); transition: all 0.12s;
}
.btn-edit-mode:hover { border-color: var(--hairline-2); color: var(--text-dim); }
.btn-edit-mode.active {
  color: #f97316;
  border-color: color-mix(in oklab, #f97316 35%, transparent);
  background: color-mix(in oklab, #f97316 8%, transparent);
}

.confirm-toast {
  position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
  background: var(--surface-2); border: 1px solid #ef4444; border-radius: 10px;
  padding: 12px 20px; font-size: 13px; color: var(--text);
  box-shadow: 0 8px 32px rgba(0,0,0,0.5); z-index: 200;
  display: none; align-items: center; gap: 14px; white-space: nowrap;
}
.confirm-toast.show { display: flex; }
.confirm-sub { font-size: 11px; color: var(--text-mute); }
.toast-cancel {
  font-size: 12px; color: var(--text-mute); cursor: pointer;
  padding: 4px 10px; border-radius: 5px; border: 1px solid var(--hairline-2);
  background: none; font-family: inherit;
}
.toast-cancel:hover { color: var(--text); background: var(--surface-3); }
.toast-delete {
  font-size: 12px; color: #fff; background: #ef4444;
  cursor: pointer; padding: 4px 12px; border-radius: 5px; border: none; font-family: inherit;
}
.toast-delete:hover { background: #dc2626; }

.subjects-empty { font-size: 13px; color: var(--text-mute); padding: 24px 0; }

/* Hub page */
.hub-header { margin-bottom: 24px; }
.hub-back {
  font-size: 12px; color: var(--text-mute); background: none; border: none;
  cursor: pointer; padding: 0 0 10px; font-family: inherit;
}
.hub-back:hover { color: var(--text); }
.hub-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.hub-dot { width: 13px; height: 13px; border-radius: 50%; flex-shrink: 0; }
.hub-name { font-size: 22px; font-weight: 700; color: var(--text); }
.hub-badge {
  font-size: 11px; padding: 2px 8px; border-radius: 20px; border: 1px solid; font-weight: 500;
}
.hub-badge-purple {
  color: var(--accent);
  border-color: color-mix(in oklab, var(--accent) 36%, transparent);
  background: color-mix(in oklab, var(--accent) 8%, transparent);
}
.hub-badge-orange {
  color: #f97316;
  border-color: color-mix(in oklab, #f97316 36%, transparent);
  background: color-mix(in oklab, #f97316 8%, transparent);
}
.hub-label-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.hub-kpi-row { display: flex; gap: 24px; }
.hub-kpi { display: flex; flex-direction: column; }
.hub-kpi-val { font-size: 20px; font-weight: 700; color: var(--text); }
.hub-kpi-lbl { font-size: 10px; color: var(--text-mute); text-transform: uppercase; letter-spacing: 0.05em; }

.hub-tabs {
  display: flex; gap: 2px;
  border-bottom: 1px solid var(--hairline);
  margin-bottom: 20px;
}
.hub-tab {
  font-size: 12px; padding: 8px 14px;
  background: none; border: none; border-bottom: 2px solid transparent;
  color: var(--text-mute); cursor: pointer; font-family: inherit;
  transition: color 0.1s, border-color 0.1s; margin-bottom: -1px;
}
.hub-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.hub-tab:hover:not(.active) { color: var(--text-dim); }

.prof-card {
  background: var(--surface); border: 1px solid var(--hairline); border-radius: 12px;
  padding: 20px; margin-bottom: 20px; display: flex; align-items: flex-start; gap: 20px;
}
.prof-card-left { display: flex; flex-direction: column; gap: 8px; }
.prof-big { font-size: 44px; font-weight: 800; letter-spacing: -0.04em; line-height: 1; }
.grade-badge {
  display: inline-block; font-size: 13px; font-weight: 700;
  padding: 2px 10px; border-radius: 20px;
  background: color-mix(in oklab, var(--accent) 12%, transparent);
  color: var(--accent); border: 1px solid color-mix(in oklab, var(--accent) 30%, transparent);
}
.prof-chart { display: flex; align-items: center; gap: 8px; }
.prof-trend { font-size: 12px; font-weight: 600; }

.hub-section { margin-bottom: 20px; }
.hub-section-title {
  font-size: 11px; font-weight: 600; color: var(--text-mute);
  text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 10px;
}
.score-row {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 0; border-bottom: 1px solid var(--hairline); font-size: 13px;
}
.score-row:last-child { border-bottom: none; }
.score-type-badge {
  font-size: 9.5px; padding: 1px 7px; border-radius: 20px;
  border: 1px solid var(--hairline); color: var(--text-mute); flex-shrink: 0;
}
.score-type-past_paper {
  border-color: color-mix(in oklab, var(--accent) 30%, transparent); color: var(--accent);
}
.score-type-school_test {
  border-color: color-mix(in oklab, #f97316 30%, transparent); color: #f97316;
}
.score-title {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; color: var(--text-dim);
}
.score-date { font-size: 11px; color: var(--text-mute); flex-shrink: 0; }
.score-pct { font-size: 13px; font-weight: 600; min-width: 40px; text-align: right; flex-shrink: 0; }

.progress-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.progress-grade { font-size: 12px; font-weight: 700; color: var(--text-dim); min-width: 24px; }
.progress-bar-track { flex: 1; height: 6px; background: var(--surface-3); border-radius: 3px; overflow: hidden; }
.progress-bar-fill { height: 100%; background: var(--accent); border-radius: 3px; }
.progress-gap { font-size: 12px; }

.assessment-table {
  width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px;
}
.assessment-table th {
  text-align: left; font-size: 10px; color: var(--text-faint);
  text-transform: uppercase; letter-spacing: 0.05em;
  padding: 4px 10px; border-bottom: 1px solid var(--hairline);
}
.assessment-table td { padding: 8px 10px; border-bottom: 1px solid var(--hairline); color: var(--text-dim); }
.assessment-table tr:last-child td { border-bottom: none; }

.assessment-form-wrap { margin-bottom: 16px; }
.btn-log-assessment {
  font-size: 12px; color: var(--accent);
  border: 1px solid color-mix(in oklab, var(--accent) 30%, transparent);
  background: color-mix(in oklab, var(--accent) 8%, transparent);
  border-radius: 6px; padding: 5px 12px; cursor: pointer; font-family: inherit;
}
.assessment-form {
  background: var(--surface); border: 1px solid var(--hairline); border-radius: 10px;
  padding: 16px; display: flex; flex-direction: column; gap: 12px;
}
.form-row-inline { display: flex; align-items: flex-end; gap: 10px; }
.form-divider { font-size: 12px; color: var(--text-mute); padding-bottom: 8px; }

.boundary-editor { }
.boundary-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px; }
.boundary-table th {
  text-align: left; font-size: 10px; color: var(--text-faint);
  text-transform: uppercase; letter-spacing: 0.05em;
  padding: 4px 10px; border-bottom: 1px solid var(--hairline);
}
.boundary-table td { padding: 8px 10px; border-bottom: 1px solid var(--hairline); }
.boundary-table tr:last-child td { border-bottom: none; }
.boundary-grade { font-size: 13px; font-weight: 700; color: var(--text); min-width: 36px; }
.boundary-row-current td { background: color-mix(in oklab, var(--accent) 5%, transparent); }
.boundary-you-here { font-size: 11px; color: var(--accent); font-style: italic; }
.boundary-summary {
  font-size: 12px; color: var(--text-mute); margin-bottom: 12px;
  padding: 8px 12px; background: var(--surface); border: 1px solid var(--hairline); border-radius: 8px;
}

/* Shared form styles */
.form-row { display: flex; flex-direction: column; gap: 4px; }
.form-label { font-size: 11px; color: var(--text-mute); font-weight: 500; }
.form-optional { font-weight: 400; color: var(--text-faint); }
.form-input {
  background: var(--surface-2); border: 1px solid var(--hairline);
  border-radius: 6px; padding: 7px 10px;
  font-size: 13px; color: var(--text); font-family: inherit;
  outline: none; transition: border-color 0.1s;
}
.form-input:focus { border-color: color-mix(in oklab, var(--accent) 50%, transparent); }
.form-input-sm { padding: 6px 8px; font-size: 12px; max-width: 100px; }
.form-error { font-size: 12px; color: #ef4444; margin-top: 4px; }
.form-actions { display: flex; justify-content: flex-end; gap: 8px; }

.label-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.label-chip {
  font-size: 11.5px; padding: 4px 11px; border-radius: 999px;
  border: 1px solid var(--hairline); background: var(--surface);
  color: var(--text-mute); cursor: pointer; font-family: inherit; transition: all 0.12s;
}
.label-chip.selected {
  color: var(--text);
  background: color-mix(in oklab, var(--accent) 12%, var(--surface));
  border-color: color-mix(in oklab, var(--accent) 36%, var(--hairline));
}
.label-add-row { display: flex; gap: 6px; align-items: center; margin-top: 4px; }
.btn-ghost-sm {
  font-size: 11.5px; padding: 6px 10px; border-radius: 6px;
  border: 1px solid var(--hairline); background: var(--surface);
  color: var(--text-mute); cursor: pointer; font-family: inherit;
}
.btn-ghost-sm:hover { border-color: var(--hairline-2); color: var(--text-dim); }

/* Modal */
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 300; backdrop-filter: blur(2px);
}
.modal-panel {
  background: var(--surface); border: 1px solid var(--hairline-2);
  border-radius: 14px; width: 440px; max-width: calc(100vw - 32px);
  box-shadow: 0 20px 60px rgba(0,0,0,0.6);
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px 0;
}
.modal-title { font-size: 16px; font-weight: 600; color: var(--text); }
.modal-close {
  background: none; border: none; color: var(--text-mute);
  cursor: pointer; font-size: 14px; padding: 4px; border-radius: 4px;
}
.modal-close:hover { color: var(--text); }
.modal-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
.modal-footer {
  padding: 12px 20px 18px; display: flex; justify-content: flex-end; gap: 8px;
  border-top: 1px solid var(--hairline);
}

.color-swatches { display: flex; gap: 6px; flex-wrap: wrap; }
.color-swatch {
  width: 22px; height: 22px; border-radius: 50%; cursor: pointer;
  border: 2px solid transparent; transition: border-color 0.1s, transform 0.1s;
}
.color-swatch:hover { transform: scale(1.1); }
.color-swatch.selected { border-color: var(--text); }

/* Shared buttons (scoped to subjects pages to avoid conflicts) */
.subjects-page .btn-primary,
.subjects-hub-page .btn-primary,
.modal-panel .btn-primary {
  font-size: 12.5px; font-weight: 600;
  background: var(--accent); color: #fff;
  border: none; border-radius: 7px; padding: 7px 16px;
  cursor: pointer; font-family: inherit; transition: opacity 0.1s;
}
.subjects-page .btn-primary:hover,
.subjects-hub-page .btn-primary:hover,
.modal-panel .btn-primary:hover { opacity: 0.85; }
.subjects-page .btn-primary:disabled,
.subjects-hub-page .btn-primary:disabled,
.modal-panel .btn-primary:disabled { opacity: 0.4; cursor: default; }

.subjects-page .btn-secondary,
.subjects-hub-page .btn-secondary,
.modal-panel .btn-secondary {
  font-size: 12.5px; background: var(--surface-2); color: var(--text-mute);
  border: 1px solid var(--hairline); border-radius: 7px; padding: 7px 16px;
  cursor: pointer; font-family: inherit; transition: border-color 0.1s;
}
.subjects-page .btn-secondary:hover,
.subjects-hub-page .btn-secondary:hover,
.modal-panel .btn-secondary:hover { border-color: var(--hairline-2); color: var(--text-dim); }

.subjects-page .btn-ghost,
.subjects-hub-page .btn-ghost {
  font-size: 12px; color: var(--text-mute); background: none;
  border: none; cursor: pointer; font-family: inherit;
}
.subjects-page .btn-ghost:hover,
.subjects-hub-page .btn-ghost:hover { color: var(--text-dim); text-decoration: underline; }
```

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```
Expected: all tests pass (including the 9 proficiency tests from Task 2)

- [ ] **Step 6: Verify full build**

```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add src/components/icons.tsx src/App.tsx src/components/Sidebar.tsx src/styles/pages.css
git commit -m "feat: wire up /subjects routing, nav, and CSS"
```

---

## Spec Coverage Check

| Requirement | Task |
|---|---|
| `exam_board`, `target_grade` columns on `subjects` | 1, 2, 3, 4 |
| `subject_labels` + `subject_label_map` tables + RLS | 1 |
| `assessments` table + RLS | 1 |
| `subject_grade_boundaries` table + RLS | 1 |
| Extended `Subject` type + `SubjectLabel`, `Assessment`, `GradeBoundary` | 2 |
| `calcProficiency` — rolling avg last 5 sorted by `sat_on`, rounded to 1dp | 2 |
| `deriveGrade` — highest grade whose `min_pct` is met | 2 |
| Supabase helpers — labels, label map, assessments, boundaries | 3 |
| `fetchSubjects` selects `exam_board`, `target_grade` | 3 |
| `patchSubject` widened | 3 |
| `editSubject` widened | 4 |
| `addSubject` extended for optional fields | 4 |
| `useSubjectLabelStore` | 5 |
| `useAssessmentStore` | 6 |
| `SubjectEditModal` — name, color, exam board, target grade, labels | 7 |
| `SubjectCard` — proficiency bar, grade, gap-to-target, mastery flame | 8 |
| `/subjects` index — header, filter bar, column headers, edit mode, delete toast, empty state | 9 |
| Card navigation to `/subjects/:id` | 9 |
| `ProficiencyChart` — SVG sparkline | 10 |
| `/subjects/:id` hub — header (badges, labels, KPIs), tabs | 10 |
| Stats tab — proficiency card, recent scores, progress-to-target row | 10 |
| Past Papers tab — table + log form | 10, 11 |
| School Tests tab — list + log form | 10, 11 |
| `AssessmentForm` — title, marks, date, validation | 11 |
| Grade Boundaries tab — editable table, "you are here", reset | 12 |
| `GradeBoundaryEditor` | 12 |
| `/subjects` and `/subjects/:id` routes (lazy) | 13 |
| Subjects nav link in Sidebar | 13 |
