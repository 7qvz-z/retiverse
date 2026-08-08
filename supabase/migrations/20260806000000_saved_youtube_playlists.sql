-- 他人の公開プレイリストを URL/ID で登録して一覧・解析に使う
alter table public.profiles
  add column if not exists saved_youtube_playlists jsonb not null default '[]'::jsonb;

comment on column public.profiles.saved_youtube_playlists is
  'User-registered third-party YouTube playlists: [{ id, title, itemCount, thumbnailUrl }]';
