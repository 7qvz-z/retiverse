-- YouTube search.list 結果キャッシュ（TTL 運用・service role のみ）
-- 同じクエリの再検索で API 枠を節約する

create table if not exists public.youtube_search_cache (
  id uuid primary key default gen_random_uuid(),
  query_key text not null unique,
  results jsonb not null default '[]'::jsonb,
  hit_count int not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists youtube_search_cache_expires_at_idx
  on public.youtube_search_cache (expires_at);

comment on table public.youtube_search_cache is
  'Cached YouTube Data API search.list results. Service role only. TTL typically 24h.';

alter table public.youtube_search_cache enable row level security;

-- クライアントからは読めない（ポリシー無し + revoke）
revoke all on table public.youtube_search_cache from anon, authenticated;
