/**
 * Tiny module-level cache for the current user's ID.
 *
 * Avoids calling supabase.auth.getSession() (async) in every fire-and-forget
 * write inside the data stores, and sidesteps circular-import issues that
 * would arise from importing useAuthStore directly into those stores.
 *
 * Usage:
 *   setCurrentUserId(id)  — called by useAuthStore on sign-in / sign-out
 *   getCurrentUserId()    — called by useXPStore, useStreakStore, useSubjectStore
 */

let _userId: string | null = null

export function getCurrentUserId(): string | null {
  return _userId
}

export function setCurrentUserId(id: string | null): void {
  _userId = id ?? null
}
