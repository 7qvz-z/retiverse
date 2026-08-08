-- profiles: first-time terms & privacy consent
alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;
