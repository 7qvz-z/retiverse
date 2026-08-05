-- User corrections for artist extraction (learning + persistence)
create table if not exists public.artist_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('alias', 'reject', 'rename', 'confirm', 'split')),
  raw_name text not null,
  canonical_name text,
  split_into text[] not null default '{}',
  source_title text,
  source_channel text,
  created_at timestamptz not null default now()
);

create index if not exists artist_corrections_user_id_idx
  on public.artist_corrections (user_id);

create index if not exists artist_corrections_user_raw_idx
  on public.artist_corrections (user_id, raw_name);

alter table public.artist_corrections enable row level security;

create policy "artist_corrections_own"
  on public.artist_corrections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
