-- YouTube Data API クォータ消費のアプリ側記録（マイページ表示用）
-- 公式クォータはプロジェクト単位。本テーブルは推定・可視化用。

create table if not exists public.youtube_api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  operation text not null,
  units int not null default 0,
  from_cache boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists youtube_api_usage_created_at_idx
  on public.youtube_api_usage (created_at desc);

create index if not exists youtube_api_usage_user_created_idx
  on public.youtube_api_usage (user_id, created_at desc);

comment on table public.youtube_api_usage is
  'Estimated YouTube Data API quota usage events for Me page. Not an official Google meter.';

alter table public.youtube_api_usage enable row level security;

create policy "youtube_api_usage_select_own"
  on public.youtube_api_usage
  for select
  using (auth.uid() = user_id);

-- insert は service role のみ（ポリシー無しで authenticated は insert 不可）
revoke insert, update, delete on table public.youtube_api_usage from anon, authenticated;
grant select on table public.youtube_api_usage to authenticated;
