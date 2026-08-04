-- Retiverse MVP schema (profiles + preferences stored as jsonb)
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  youtube_channel_id text,
  onboarding_completed boolean not null default false,
  favorite_artists text[] not null default '{}',
  favorite_genres text[] not null default '{}',
  preferences jsonb not null default '{
    "considerSeason": false,
    "considerWeather": false,
    "considerTimeOfDay": false,
    "mixNewTracks": false,
    "excludeRecentlyPlayed": false,
    "preventArtistBias": true,
    "randomnessEnabled": true,
    "trackCount": 100,
    "maxTracksPerArtist": 5,
    "randomnessPercent": 30
  }'::jsonb,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playlist_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  mood text,
  environments text[] not null default '{}',
  youtube_playlist_id text,
  track_ids text[] not null default '{}',
  title text,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.track_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  youtube_video_id text not null,
  event_type text not null check (event_type in ('play', 'skip', 'favorite')),
  generation_id uuid references public.playlist_generations (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.preference_change_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  changes jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.playlist_generations enable row level security;
alter table public.track_events enable row level security;
alter table public.preference_change_logs enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "generations_own" on public.playlist_generations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "track_events_own" on public.track_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "pref_logs_own" on public.preference_change_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
