-- ─── Notebook — Supabase schema ─────────────────────────────────────────────
-- Paste this into the Supabase SQL editor and run it once.

-- 1. Users table (one row per auth user, stores XP)
create table if not exists public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  xp         integer not null default 0,
  created_at timestamptz not null default now()
);

-- 2. Sessions table (every completed Pomodoro/break; source of truth for stats)
create table if not exists public.sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  type         text not null check (type in ('work', 'shortBreak', 'longBreak')),
  completed_at timestamptz not null default now(),
  xp           integer not null default 0,
  subject      text,
  created_at   timestamptz not null default now()
);

-- 3. Daily logins table (streaks — one row per user per calendar day)
create table if not exists public.daily_logins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  date       date not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ─── Row-level security ───────────────────────────────────────────────────────
alter table public.users        enable row level security;
alter table public.sessions     enable row level security;
alter table public.daily_logins enable row level security;

-- Each user can only read/write their own rows
create policy "own users row"    on public.users        for all using (auth.uid() = id);
create policy "own sessions"     on public.sessions     for all using (auth.uid() = user_id);
create policy "own daily_logins" on public.daily_logins for all using (auth.uid() = user_id);

-- ─── Step 4: Subjects feature ────────────────────────────────────────────────
-- Run this block after the initial schema (safe to re-run — uses IF NOT EXISTS)

create table if not exists public.subjects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  name       text not null,
  color      text not null default '#7c6af0',
  created_at timestamptz not null default now()
);

alter table public.subjects enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'subjects' and policyname = 'own subjects'
  ) then
    create policy "own subjects" on public.subjects for all using (auth.uid() = user_id);
  end if;
end $$;

-- Add subject_id FK to sessions (safe to re-run)
alter table public.sessions
  add column if not exists subject_id uuid references public.subjects(id) on delete set null;

-- ─── Auto-create users row on sign-up ────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
