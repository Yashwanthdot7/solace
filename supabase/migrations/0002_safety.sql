-- =============================================================
-- Solace — Phase 1 (safety)
-- Run after 0001_init.sql.
-- =============================================================

-- Crisis level of each Mitra message: none | concern | crisis
alter table public.mitra_messages
  add column if not exists risk_level text not null default 'none'
  check (risk_level in ('none', 'concern', 'crisis'));
create index if not exists mitra_messages_risk_idx
  on public.mitra_messages (risk_level) where risk_level <> 'none';

-- Feed posts can be held back from public view (crisis posts, or posts
-- reported by several people) until someone reviews them.
alter table public.posts
  add column if not exists status text not null default 'visible'
  check (status in ('visible', 'held'));
create index if not exists posts_status_ts_idx on public.posts (status, ts desc);

-- Reports of feed posts, one per person per post.
create table if not exists public.post_reports (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts (id) on delete cascade,
  reporter_id  uuid not null references public.users (id) on delete cascade,
  reason       text not null default '',
  ts           timestamptz not null default now(),
  unique (post_id, reporter_id)
);
create index if not exists post_reports_post_idx on public.post_reports (post_id);

alter table public.post_reports enable row level security;
