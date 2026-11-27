-- ============================================================================
-- Finance module — Phase 2: Telegram intake
--
-- Account linking (profiles.telegram_user_id + one-time link codes) and a
-- small server-side session store for the grammY conversation state.
-- ============================================================================

-- Map a Telegram account to an ERP profile (set by the bot via /link).
alter table public.profiles
  add column if not exists telegram_user_id bigint unique;

-- One-time codes the user generates in the web app and redeems in Telegram.
create table if not exists public.telegram_link_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  expires_at  timestamptz not null,
  used        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists telegram_link_codes_user_idx on public.telegram_link_codes(user_id);

-- Server-side session store for the grammY bot (keyed by its session key).
create table if not exists public.telegram_sessions (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table public.telegram_link_codes enable row level security;
alter table public.telegram_sessions   enable row level security;

-- A user can create and read their own link codes. The bot reads/updates codes
-- through the service-role client, which bypasses RLS.
drop policy if exists telegram_link_codes_insert on public.telegram_link_codes;
create policy telegram_link_codes_insert on public.telegram_link_codes
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists telegram_link_codes_select on public.telegram_link_codes;
create policy telegram_link_codes_select on public.telegram_link_codes
  for select to authenticated
  using (user_id = auth.uid());

-- telegram_sessions is only ever touched by the service-role client.
-- RLS enabled with no policies => no access for anon/authenticated roles.
