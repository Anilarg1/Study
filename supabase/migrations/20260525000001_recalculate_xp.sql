-- Recalculate XP for all historical sessions using the new formula.
-- Base formula only (no streak multiplier — cannot retroactively know streak state).
-- Sessions with duration_secs IS NULL keep their existing XP.
--
-- Formula:
--   work sessions, duration < 25 min  → floor(duration_mins)
--   work sessions, duration >= 25 min → floor(duration_mins^1.5 / 5)
--   short_break → 5 XP (unchanged)
--   long_break  → 10 XP (unchanged)

update public.sessions
set xp = case
  when type != 'work' then xp   -- keep break XP unchanged
  when duration_secs is null    then xp   -- no duration, keep legacy
  when duration_secs / 60.0 < 25
    then floor(duration_secs / 60.0)::integer
  else
    floor(power(duration_secs / 60.0, 1.5) / 5)::integer
end
where type = 'work';

-- Recalculate each user's total XP from their updated sessions
update public.users u
set xp = (
  select coalesce(sum(s.xp), 0)
  from public.sessions s
  where s.user_id = u.id
);

-- Backfill subject_xp from historical work sessions with a subject_id
insert into public.subject_xp (user_id, subject_id, xp, updated_at)
select
  user_id,
  subject_id,
  sum(xp)::integer as xp,
  now()
from public.sessions
where type = 'work'
  and subject_id is not null
group by user_id, subject_id
on conflict (user_id, subject_id)
do update set
  xp         = excluded.xp,
  updated_at = excluded.updated_at;
