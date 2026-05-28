// TODO: Replace `data as Subject[]` / `data as Tag` manual casts with generated types.
// Run: npx supabase gen types typescript --project-id <your-project-id> > src/types/supabase.ts
// Then use Database['public']['Tables']['subjects']['Row'] etc. for full type safety.

import { createClient } from '@supabase/supabase-js'
import type { PostgrestError, PostgrestSingleResponse } from '@supabase/supabase-js'
import type { Subject, Tag, SessionEntry, TimerMode, SubjectLabel, Assessment, GradeBoundary, Task } from '../types'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── User / XP helpers ────────────────────────────────────────────────────────

/** Fetch the user's current XP from the users table. */
export async function fetchUserXP(userId: string): Promise<PostgrestSingleResponse<{ xp: number }>> {
  return supabase
    .from('users')
    .select('xp')
    .eq('id', userId)
    .single()
}

/**
 * Overwrite the user's XP.
 * Called fire-and-forget after every awardXP().
 */
export async function upsertUserXP(userId: string, xp: number): Promise<PostgrestError | null> {
  const { error } = await supabase
    .from('users')
    .upsert({ id: userId, xp }, { onConflict: 'id' })
  return error
}

/**
 * Insert a completed-session record.
 * Called fire-and-forget after every awardXP().
 */
export async function insertSession(userId: string, session: SessionEntry): Promise<PostgrestError | null> {
  const { error } = await supabase.from('sessions').insert({
    id:            session.id,
    user_id:       userId,
    type:          session.type,
    completed_at:  session.completedAt,
    xp:            session.xp,
    subject_id:    session.subjectId   ?? null,
    tag_id:        session.tagId       ?? null,
    duration_secs: session.durationSecs ?? null,
  })
  return error
}

/**
 * Fetch completed sessions for a user, ordered newest-first.
 * Pass `limit` to cap results (default: no cap).
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
    id:           r.id            as string,
    type:         r.type          as TimerMode,
    completedAt:  r.completed_at  as string,
    xp:           r.xp            as number,
    subjectId:    r.subject_id    as string | null,
    tagId:        r.tag_id        as string | null,
    durationSecs: r.duration_secs as number | null,
  }))

  return { data: sessions, error: null }
}

/** Fetch all login dates for the user as a string[] (YYYY-MM-DD). */
export async function fetchLoginDates(userId: string): Promise<{ data: string[], error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('daily_logins')
    .select('date')
    .eq('user_id', userId)
  return { data: data?.map(r => r.date as string) ?? [], error }
}

/**
 * Upsert today's login (idempotent — unique constraint on user_id + date).
 * Called fire-and-forget from clockIn().
 */
export async function upsertDailyLogin(userId: string, date: string): Promise<PostgrestError | null> {
  const { error } = await supabase
    .from('daily_logins')
    .upsert({ user_id: userId, date }, { onConflict: 'user_id,date' })
  return error
}

// ─── Subjects helpers ─────────────────────────────────────────────────────────

/** Fetch all subjects for a user, ordered by creation time. */
export async function fetchSubjects(userId: string): Promise<{ data: Subject[], error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name, color, exam_board, target_grade, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  return { data: (data as Subject[]) ?? [], error }
}

/** Insert a new subject. Returns the created row. */
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

/** Update an existing subject's fields. */
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

/** Delete a subject by id. */
export async function removeSubject(subjectId: string): Promise<PostgrestError | null> {
  const { error } = await supabase
    .from('subjects')
    .delete()
    .eq('id', subjectId)
  return error
}

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
  return { data: withPercentage([data as Omit<Assessment, 'percentage'>])[0] ?? null, error: null }
}

export async function deleteAssessment(id: string): Promise<PostgrestError | null> {
  const { error } = await supabase.from('assessments').delete().eq('id', id)
  return error
}

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

// ─── Tags helpers ─────────────────────────────────────────────────────────────

/** Fetch all tags for a user, ordered by creation time. */
export async function fetchTags(userId: string): Promise<{ data: Tag[], error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('tags')
    .select('id, name, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  return { data: (data as Tag[]) ?? [], error }
}

/** Insert a new tag. Returns the created row. */
export async function createTag(
  userId: string,
  { name }: { name: string },
): Promise<{ data: Tag | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('tags')
    .insert({ user_id: userId, name })
    .select()
    .single()
  return { data: data as Tag | null, error }
}

/** Delete a tag by id. Sessions referencing it will have tag_id set to null. */
export async function removeTag(tagId: string): Promise<PostgrestError | null> {
  const { error } = await supabase
    .from('tags')
    .delete()
    .eq('id', tagId)
  return error
}

// ─── Subject XP helpers ───────────────────────────────────────────────────────

/** Fetch all subject XP rows for a user. */
export async function fetchSubjectXP(
  userId: string,
): Promise<{ data: { subjectId: string; xp: number }[]; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('subject_xp')
    .select('subject_id, xp')
    .eq('user_id', userId)
  if (error || !data) return { data: [], error }
  return {
    data: data.map(r => ({ subjectId: r.subject_id as string, xp: r.xp as number })),
    error: null,
  }
}

/**
 * Upsert the total XP for a subject (overwrites, does not increment).
 * Call fire-and-forget after updating local state.
 */
export async function upsertSubjectXP(
  userId: string,
  subjectId: string,
  totalXP: number,
): Promise<PostgrestError | null> {
  const { error } = await supabase
    .from('subject_xp')
    .upsert(
      { user_id: userId, subject_id: subjectId, xp: totalXP, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,subject_id' },
    )
  return error
}

// ─── Tasks ────────────────────────────────────────────────────

export async function fetchTasks(userId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('due_date', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createTask(
  task: Omit<Task, 'id' | 'created_at'>,
): Promise<Task | null> {
  const { data, error } = await supabase
    .from('tasks')
    .insert(task)
    .select()
    .single()
  if (error) { console.error(error); return null }
  return data
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<void> {
  const { error } = await supabase.from('tasks').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}
