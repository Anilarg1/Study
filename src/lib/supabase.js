import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── DB helpers ───────────────────────────────────────────────────────────────

/** Fetch the user's current XP from the users table. */
export async function fetchUserXP(userId) {
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
export async function upsertUserXP(userId, xp) {
  const { error } = await supabase
    .from('users')
    .upsert({ id: userId, xp }, { onConflict: 'id' })
  return error
}

/**
 * Insert a completed-session record.
 * Called fire-and-forget after every awardXP().
 */
export async function insertSession(userId, session) {
  const { error } = await supabase.from('sessions').insert({
    id:           session.id,
    user_id:      userId,
    type:         session.type,
    completed_at: session.completedAt,
    xp:           session.xp,
    subject:      session.subject || null,
  })
  return error
}

/** Fetch all login dates for the user as a string[] (YYYY-MM-DD). */
export async function fetchLoginDates(userId) {
  const { data, error } = await supabase
    .from('daily_logins')
    .select('date')
    .eq('user_id', userId)
  return { data: data?.map(r => r.date) ?? [], error }
}

/**
 * Upsert today's login (idempotent — unique constraint on user_id + date).
 * Called fire-and-forget from clockIn().
 */
export async function upsertDailyLogin(userId, date) {
  const { error } = await supabase
    .from('daily_logins')
    .upsert({ user_id: userId, date }, { onConflict: 'user_id,date' })
  return error
}
