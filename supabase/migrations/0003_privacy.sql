-- =============================================================
-- Solace — Phase 2 (privacy & consent)
-- Run after 0002_safety.sql.
-- =============================================================

-- When the user agreed to the privacy policy and terms.
alter table public.users add column if not exists consented_at timestamptz;

-- Guardian links: a member invites a guardian, the guardian accepts.
-- Guardians only see anything while status = 'active'.
create table if not exists public.guardian_links (
  id               uuid primary key default gen_random_uuid(),
  member_id        uuid not null references public.users (id) on delete cascade,
  member_name      text,
  guardian_email   text not null,
  guardian_id      uuid references public.users (id) on delete cascade,
  status           text not null default 'pending'
                   check (status in ('pending', 'active', 'revoked')),
  share_level      text not null default 'summary'
                   check (share_level in ('summary', 'moods')),
  alert_on_crisis  boolean not null default false,
  created_at       timestamptz not null default now(),
  accepted_at      timestamptz,
  revoked_at       timestamptz,
  last_alert_at    timestamptz
);
create index if not exists guardian_links_member_idx on public.guardian_links (member_id);
create index if not exists guardian_links_guardian_idx on public.guardian_links (guardian_id, status);
create index if not exists guardian_links_email_idx on public.guardian_links (guardian_email, status);

alter table public.guardian_links enable row level security;

-- Old behaviour: users.guardian_email gave a guardian instant access with
-- no consent. Turn every existing one into a PENDING invite (the guardian
-- must now accept), then clear the old column.
insert into public.guardian_links (member_id, member_name, guardian_email, status)
select u.id, u.name, lower(trim(u.guardian_email)), 'pending'
from public.users u
where u.guardian_email is not null
  and trim(u.guardian_email) <> ''
  and not exists (
    select 1 from public.guardian_links g
    where g.member_id = u.id and g.guardian_email = lower(trim(u.guardian_email))
  );

update public.users set guardian_email = null where guardian_email is not null;
