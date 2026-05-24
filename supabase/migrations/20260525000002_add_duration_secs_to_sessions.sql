-- Add duration_secs column to sessions table.
-- Required by insertSession() which writes durationSecs for the new XP formula.
alter table public.sessions
  add column if not exists duration_secs integer;
