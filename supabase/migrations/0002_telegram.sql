-- ===========================================================================
-- Finance module — Phase 2: Telegram intake
-- Account linking + server-side conversational flow state.
-- Run after 0001_finance_phase1.sql. Idempotent.
-- ===========================================================================

-- Link a Telegram account to an ERP profile.
alter table profiles add column if not exists telegram_user_id bigint unique;

-- One-time codes the user generates in Settings and sends to the bot as /link <code>.
create table if not exists telegram_link_codes (
  code text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_tg_link_user on telegram_link_codes (user_id);

-- Per-chat conversational state for the /pay flow (serverless-safe).
create table if not exists telegram_flow (
  chat_id bigint primary key,
  user_id uuid references profiles(id) on delete cascade,
  step text,
  draft jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- All Telegram access is via the service-role key in server routes; lock out anon.
alter table telegram_link_codes enable row level security;
alter table telegram_flow enable row level security;
