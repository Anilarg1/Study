-- subject_xp: tracks per-user, per-subject XP totals for mastery tiers
create table if not exists public.subject_xp (
  user_id    uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  xp         integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, subject_id)
);

-- RLS: users can only read/write their own rows
alter table public.subject_xp enable row level security;

create policy "Users can read own subject_xp"
  on public.subject_xp for select
  using (auth.uid() = user_id);

create policy "Users can upsert own subject_xp"
  on public.subject_xp for insert
  with check (auth.uid() = user_id);

create policy "Users can update own subject_xp"
  on public.subject_xp for update
  using (auth.uid() = user_id);

-- Index for fast per-user lookups
create index if not exists subject_xp_user_id_idx on public.subject_xp(user_id);
