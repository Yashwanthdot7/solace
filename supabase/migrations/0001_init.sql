-- =============================================================
-- Solace — initial database schema
-- Creates the 12 tables that backend/server.py reads and writes.
--
-- How to run: Supabase dashboard → SQL Editor → paste this file → Run.
-- (Or with the Supabase CLI: `supabase db push`.)
--
-- The backend connects with the secret (service-role) key, which
-- bypasses Row Level Security. RLS is still switched on for every
-- table with NO policies, so the public "anon" key cannot read or
-- write anything directly.
-- =============================================================

create extension if not exists "pgcrypto";

-- ── users ────────────────────────────────────────────────────
create table if not exists public.users (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  password        text not null,               -- bcrypt hash, never plain text
  name            text not null,
  role            text not null default 'community'
                  check (role in ('elder', 'youth', 'community', 'guardian')),
  locality        text default 'Bengaluru',
  age             int,
  points          int  not null default 0,
  streak          int  not null default 1,
  score           int  not null default 72,
  band            text check (band in ('green', 'amber', 'red')),
  goals           jsonb not null default '[]'::jsonb,
  guardian_email  text,
  email_verified  boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists users_guardian_email_idx on public.users (guardian_email);

-- ── otps (email verification codes) ─────────────────────────
create table if not exists public.otps (
  email    text primary key,
  otp      text not null,
  expires  timestamptz not null
);

-- ── password_resets ─────────────────────────────────────────
create table if not exists public.password_resets (
  token    text primary key,
  email    text not null,
  expires  timestamptz not null
);
create index if not exists password_resets_email_idx on public.password_resets (email);

-- ── mitra_messages (AI companion chat log) ──────────────────
create table if not exists public.mitra_messages (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid references public.users (id) on delete cascade,
  message  text not null,
  reply    text,
  mood     text,
  ts       timestamptz not null default now()
);
create index if not exists mitra_messages_user_ts_idx on public.mitra_messages (user_id, ts desc);

-- ── journal ──────────────────────────────────────────────────
create table if not exists public.journal (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references public.users (id) on delete cascade,
  text     text not null,
  mood     text not null default 'calm'
           check (mood in ('bright', 'calm', 'tender', 'heavy', 'blue')),
  ts       timestamptz not null default now()
);
create index if not exists journal_user_ts_idx on public.journal (user_id, ts desc);

-- ── joy_completions (daily joy challenge) ───────────────────
create table if not exists public.joy_completions (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references public.users (id) on delete cascade,
  date     date not null,
  ts       timestamptz not null default now(),
  unique (user_id, date)
);
create index if not exists joy_completions_user_ts_idx on public.joy_completions (user_id, ts desc);

-- ── posts (community feed; organiser events are posts with category='event') ──
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users (id) on delete cascade,
  author      text not null,
  role        text,
  text        text not null,
  category    text not null default 'general',
  image       text,
  hearts      int  not null default 0,
  event_meta  jsonb,
  ts          timestamptz not null default now()
);
create index if not exists posts_ts_idx on public.posts (ts desc);
create index if not exists posts_user_ts_idx on public.posts (user_id, ts desc);

-- ── rsvps (event sign-ups; event_id can be a post id or a Gemini/static event id) ──
create table if not exists public.rsvps (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.users (id) on delete cascade,
  event_id  text not null,
  ts        timestamptz not null default now()
);
create index if not exists rsvps_user_ts_idx on public.rsvps (user_id, ts desc);
create index if not exists rsvps_event_idx on public.rsvps (event_id);

-- ── events_cache (6-hour cache of live events from Gemini) ──
create table if not exists public.events_cache (
  id          text primary key,
  data        jsonb not null,
  fetched_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

-- ── hobbies ──────────────────────────────────────────────────
create table if not exists public.hobbies (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users (id) on delete cascade,
  name            text not null,
  goal_per_week   int  not null default 3,
  done_this_week  int  not null default 0,
  ts              timestamptz not null default now()
);
create index if not exists hobbies_user_ts_idx on public.hobbies (user_id, ts desc);

-- ── organiser_tasks (tasks community organisers issue) ──────
create table if not exists public.organiser_tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  audience   text not null default 'all' check (audience in ('elder', 'youth', 'all')),
  points     int  not null default 10,
  issued_by  text not null,
  claims     int  not null default 0,
  ts         timestamptz not null default now()
);
create index if not exists organiser_tasks_ts_idx on public.organiser_tasks (ts desc);

-- ── wellness_log (completed mindfulness / exercise sessions) ─
create table if not exists public.wellness_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  session_id  text not null,
  ts          timestamptz not null default now()
);
create index if not exists wellness_log_user_ts_idx on public.wellness_log (user_id, ts desc);

-- ── Row Level Security: on for every table, no public policies ──
alter table public.users            enable row level security;
alter table public.otps             enable row level security;
alter table public.password_resets  enable row level security;
alter table public.mitra_messages   enable row level security;
alter table public.journal          enable row level security;
alter table public.joy_completions  enable row level security;
alter table public.posts            enable row level security;
alter table public.rsvps            enable row level security;
alter table public.events_cache     enable row level security;
alter table public.hobbies          enable row level security;
alter table public.organiser_tasks  enable row level security;
alter table public.wellness_log     enable row level security;
