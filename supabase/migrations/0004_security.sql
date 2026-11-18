-- =============================================================
-- Solace — Phase 3 (security)
-- Run after 0003_privacy.sql.
-- =============================================================

-- Count wrong guesses on each sign-up code (the code is deleted after 5).
alter table public.otps add column if not exists attempts int not null default 0;

-- One heart per person per post.
create table if not exists public.post_hearts (
  id       uuid primary key default gen_random_uuid(),
  post_id  uuid not null references public.posts (id) on delete cascade,
  user_id  uuid not null references public.users (id) on delete cascade,
  ts       timestamptz not null default now(),
  unique (post_id, user_id)
);

-- One claim per person per organiser task.
create table if not exists public.task_claims (
  id       uuid primary key default gen_random_uuid(),
  task_id  uuid not null references public.organiser_tasks (id) on delete cascade,
  user_id  uuid not null references public.users (id) on delete cascade,
  ts       timestamptz not null default now(),
  unique (task_id, user_id)
);

-- One riddle answer per person per day.
create table if not exists public.riddle_answers (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references public.users (id) on delete cascade,
  date     date not null,
  correct  boolean not null default false,
  ts       timestamptz not null default now(),
  unique (user_id, date)
);

-- One RSVP per person per event. Remove old duplicates first (keep the earliest).
delete from public.rsvps r
using public.rsvps older
where r.user_id = older.user_id
  and r.event_id = older.event_id
  and (r.ts, r.id::text) > (older.ts, older.id::text);
create unique index if not exists rsvps_user_event_uidx on public.rsvps (user_id, event_id);

alter table public.post_hearts    enable row level security;
alter table public.task_claims    enable row level security;
alter table public.riddle_answers enable row level security;
