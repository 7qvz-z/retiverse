-- YouTube 用 Google トークンを profiles に保存（access は約1時間で切れるため refresh を永続化）
-- authenticated / anon からはトークン列を読めない（service role のみ）

alter table public.profiles
  add column if not exists google_refresh_token text,
  add column if not exists google_access_token text,
  add column if not exists google_token_expires_at timestamptz;

-- クライアントの select('*') でトークンが漏れないようにする
revoke select (
  google_refresh_token,
  google_access_token,
  google_token_expires_at
) on table public.profiles from authenticated, anon;

comment on column public.profiles.google_refresh_token is
  'Google OAuth refresh token for YouTube. Service role only.';
