-- YouTube playlist analysis storage
alter table public.profiles
  add column if not exists analyzed_playlist_ids text[] not null default '{}';

alter table public.profiles
  add column if not exists playlist_analysis jsonb;
