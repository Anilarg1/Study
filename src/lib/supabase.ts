import { createClient } from '@supabase/supabase-js'
import type { PostgrestError, PostgrestSingleResponse } from '@supabase/supabase-js'
import type { Subject, Tag, SessionEntry, TimerMode } from '../types'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── User / XP helpers ────────────────────────────────────────────────────────

/** Fetch the user's current XP from the users table. */
export function fetchUserXP(userId: string): Promise<PostgrestSingleResponse<{ xp: number }>> {
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
    .select('id, name, color, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  return { data: (data as Subject[]) ?? [], error }
}

/** Insert a new subject. Returns the created row. */
export async function createSubject(
  userId: string,
  { name, color }: { name: string; color: string },
): Promise<{ data: Subject | null; error: PostgrestError | null }> {
  const { data, error } = await supabase
    .from('subjects')
    .insert({ user_id: userId, name, color })
    .select()
    .single()
  return { data: data as Subject | null, error }
}

/** Update an existing subject's name and/or color. */
export async function patchSubject(
  subjectId: string,
  updates: Partial<Pick<Subject, 'name' | 'color'>>,
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
