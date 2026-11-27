-- ============================================================================
-- Finance module — Phase 1: payment-request workflow
-- Ever Spark Technologies ERP
--
-- Interim book of record (no double-entry GL / IFRS statements yet).
-- Segregation of duties is a HARD rule: requester != approver, approver != payer.
-- Receipts live in a PRIVATE storage bucket served via signed URLs.
-- ETB-only for now (currency column kept for later).
-- ============================================================================

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type payment_status as enum (
    'draft', 'submitted', 'clarification', 'approved', 'rejected',
    'processing', 'paid', 'posted', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum (
    'bank_transfer', 'check', 'telebirr', 'petty_cash', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_kind as enum (
    'proforma', 'invoice', 'receipt', 'grn', 'pra', 'bpv',
    'bank_advice', 'contract', 'other'
  );
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- Helper: current user's role (SECURITY DEFINER to read profiles under RLS)
-- ----------------------------------------------------------------------------
create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ----------------------------------------------------------------------------
-- Reference data tables
-- ----------------------------------------------------------------------------
create table if not exists public.cost_centers (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.chart_of_accounts (
  code        text primary key,                   -- 9-digit, no spaces
  name        text not null,
  class       text not null,                      -- asset | liability | equity | revenue | expense
  created_at  timestamptz not null default now()
);

create table if not exists public.vendors (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  tin           text,
  phone         text,
  email         text,
  bank_name     text,
  bank_account  text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

create table if not exists public.approval_thresholds (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null,                    -- payment | credit
  min_amount     numeric(14,2) not null default 0,
  max_amount     numeric(14,2) not null,
  required_role  text not null,                    -- finance | admin
  requires_check boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Extend projects with budget / cost-centre / default account
-- ----------------------------------------------------------------------------
alter table public.projects add column if not exists budget          numeric(14,2);
alter table public.projects add column if not exists cost_center_id  uuid references public.cost_centers(id);
alter table public.projects add column if not exists project_coa_code text references public.chart_of_accounts(code);

-- ----------------------------------------------------------------------------
-- Payment requests (+ serial reference sequence)
-- ----------------------------------------------------------------------------
create sequence if not exists public.payment_request_seq;

create table if not exists public.payment_requests (
  id                   uuid primary key default gen_random_uuid(),
  reference            text unique,                          -- PR-YYYY-000000 (set by trigger)
  requester_id         uuid not null references public.profiles(id),
  amount               numeric(14,2) not null check (amount > 0),
  currency             text not null default 'ETB',
  purpose              text not null,
  vendor_id            uuid references public.vendors(id),
  project_id           uuid references public.projects(id),
  cost_center_id       uuid references public.cost_centers(id),
  coa_code             text references public.chart_of_accounts(code),
  payment_method       payment_method,
  requires_check       boolean not null default false,
  is_project_related   boolean not null default false,
  status               payment_status not null default 'submitted',
  current_approver_role text,
  approved_by          uuid references public.profiles(id),
  approved_at          timestamptz,
  rejected_reason      text,
  paid_by              uuid references public.profiles(id),
  paid_at              timestamptz,
  bpv_number           text,
  bank_advice_ref      text,
  posted_by            uuid references public.profiles(id),
  posted_at            timestamptz,
  external_journal_ref text,                                 -- reserved, unused (future journal/CSV export)
  source_channel       text not null default 'web',          -- web | telegram
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists payment_requests_requester_idx on public.payment_requests(requester_id);
create index if not exists payment_requests_status_idx    on public.payment_requests(status);
create index if not exists payment_requests_project_idx   on public.payment_requests(project_id);

-- ----------------------------------------------------------------------------
-- Documents attached to a payment request (storage paths, served via signed URL)
-- ----------------------------------------------------------------------------
create table if not exists public.payment_documents (
  id                  uuid primary key default gen_random_uuid(),
  payment_request_id  uuid not null references public.payment_requests(id) on delete cascade,
  kind                document_kind not null,
  url                 text not null,                 -- storage object path within the private bucket
  file_name           text not null,
  uploaded_by         uuid references public.profiles(id),
  created_at          timestamptz not null default now()
);

create index if not exists payment_documents_request_idx on public.payment_documents(payment_request_id);

-- ----------------------------------------------------------------------------
-- Append-only audit trail
-- ----------------------------------------------------------------------------
create table if not exists public.payment_events (
  id                  uuid primary key default gen_random_uuid(),
  payment_request_id  uuid not null references public.payment_requests(id) on delete cascade,
  actor_id            uuid references public.profiles(id),
  action              text not null,                 -- submit | approve | reject | clarify | pay | post | cancel | comment | document
  from_status         payment_status,
  to_status           payment_status,
  note                text,
  created_at          timestamptz not null default now()
);

create index if not exists payment_events_request_idx on public.payment_events(payment_request_id);

-- ============================================================================
-- Triggers
-- ============================================================================

-- BEFORE INSERT: set reference, requires_check, and route to an approver role.
create or replace function public.payment_requests_before_insert()
returns trigger
language plpgsql
as $$
declare
  routed_role text;
begin
  if new.reference is null then
    new.reference := 'PR-' || to_char(now(), 'YYYY') || '-' ||
                     lpad(nextval('public.payment_request_seq')::text, 6, '0');
  end if;

  -- Hard rule: payments over 30,000 ETB must be settled by check.
  new.requires_check := new.amount > 30000;

  -- Route to the approver role from the payment thresholds.
  select required_role into routed_role
  from public.approval_thresholds
  where kind = 'payment'
    and new.amount >= min_amount
    and new.amount <= max_amount
  order by min_amount desc
  limit 1;

  if new.current_approver_role is null then
    new.current_approver_role := coalesce(routed_role, 'finance');
  end if;

  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_payment_requests_before_insert on public.payment_requests;
create trigger trg_payment_requests_before_insert
  before insert on public.payment_requests
  for each row execute function public.payment_requests_before_insert();

-- BEFORE UPDATE: touch updated_at.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_payment_requests_touch on public.payment_requests;
create trigger trg_payment_requests_touch
  before update on public.payment_requests
  for each row execute function public.touch_updated_at();

-- BEFORE UPDATE: HARD GATE — cannot move to 'paid' without a settlement document.
create or replace function public.enforce_receipt_before_paid()
returns trigger
language plpgsql
as $$
declare
  doc_count integer;
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    select count(*) into doc_count
    from public.payment_documents
    where payment_request_id = new.id
      and kind in ('receipt', 'invoice', 'bpv', 'bank_advice');

    if doc_count = 0 then
      raise exception
        'Cannot mark payment % as paid: at least one receipt, invoice, BPV or bank advice document is required.',
        new.reference
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_receipt_before_paid on public.payment_requests;
create trigger trg_enforce_receipt_before_paid
  before update on public.payment_requests
  for each row execute function public.enforce_receipt_before_paid();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.cost_centers        enable row level security;
alter table public.chart_of_accounts   enable row level security;
alter table public.vendors             enable row level security;
alter table public.approval_thresholds enable row level security;
alter table public.payment_requests    enable row level security;
alter table public.payment_documents   enable row level security;
alter table public.payment_events      enable row level security;

-- Reference tables: readable by any authenticated user; finance/admin manage.
do $$
declare t text;
begin
  foreach t in array array['cost_centers', 'chart_of_accounts', 'vendors', 'approval_thresholds']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_select', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.current_app_role() in (''finance'',''admin''))',
      t || '_insert', t);

    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.current_app_role() in (''finance'',''admin''))',
      t || '_update', t);
  end loop;
end $$;

-- approval_thresholds updates are admin-only (tighten the generic update policy).
drop policy if exists approval_thresholds_update on public.approval_thresholds;
create policy approval_thresholds_update on public.approval_thresholds
  for update to authenticated
  using (public.current_app_role() = 'admin');

-- payment_requests: requester sees own; finance/admin see all.
drop policy if exists payment_requests_select on public.payment_requests;
create policy payment_requests_select on public.payment_requests
  for select to authenticated
  using (requester_id = auth.uid() or public.current_app_role() in ('finance', 'admin'));

-- insert requires requester_id = auth.uid()
drop policy if exists payment_requests_insert on public.payment_requests;
create policy payment_requests_insert on public.payment_requests
  for insert to authenticated
  with check (requester_id = auth.uid());

-- updates (approvals/payments) handled by finance/admin
drop policy if exists payment_requests_update on public.payment_requests;
create policy payment_requests_update on public.payment_requests
  for update to authenticated
  using (public.current_app_role() in ('finance', 'admin'));

-- payment_documents: visible to those who can see the parent request; insert by uploader.
drop policy if exists payment_documents_select on public.payment_documents;
create policy payment_documents_select on public.payment_documents
  for select to authenticated
  using (
    exists (
      select 1 from public.payment_requests pr
      where pr.id = payment_request_id
        and (pr.requester_id = auth.uid() or public.current_app_role() in ('finance', 'admin'))
    )
  );

drop policy if exists payment_documents_insert on public.payment_documents;
create policy payment_documents_insert on public.payment_documents
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.payment_requests pr
      where pr.id = payment_request_id
        and (pr.requester_id = auth.uid() or public.current_app_role() in ('finance', 'admin'))
    )
  );

-- payment_events: APPEND-ONLY — select + insert only, no update/delete policies.
drop policy if exists payment_events_select on public.payment_events;
create policy payment_events_select on public.payment_events
  for select to authenticated
  using (
    exists (
      select 1 from public.payment_requests pr
      where pr.id = payment_request_id
        and (pr.requester_id = auth.uid() or public.current_app_role() in ('finance', 'admin'))
    )
  );

drop policy if exists payment_events_insert on public.payment_events;
create policy payment_events_insert on public.payment_events
  for insert to authenticated
  with check (actor_id = auth.uid());

-- ============================================================================
-- Private storage bucket for receipts / proformas / invoices
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('payment-documents', 'payment-documents', false)
on conflict (id) do nothing;

-- ============================================================================
-- Seed data
-- ============================================================================

-- Cost centres
insert into public.cost_centers (code, name) values
  ('ADMIN', 'Administration'),
  ('OPS',   'Operations'),
  ('SALES', 'Sales & Marketing'),
  ('PROJ',  'Projects')
on conflict (code) do nothing;

-- Approval thresholds
insert into public.approval_thresholds (kind, min_amount, max_amount, required_role, requires_check) values
  ('payment', 0,        50000,        'finance', false),
  ('payment', 50000.01, 999999999999, 'admin',   true),
  ('credit',  0,        100000,       'finance', false),
  ('credit',  100000.01,999999999999, 'admin',   false)
on conflict do nothing;

-- Chart of accounts (9-digit codes, no spaces) — key codes from the company finance manual
insert into public.chart_of_accounts (code, name, class) values
  -- Assets
  ('100001001', 'Cash on Hand',                 'asset'),
  ('100002001', 'Bank - CBE',                   'asset'),
  ('100002002', 'Bank - Awash',                 'asset'),
  ('110001001', 'Accounts Receivable',          'asset'),
  ('120001001', 'Inventory',                     'asset'),
  ('130001001', 'Prepaid Expenses',             'asset'),
  ('150001001', 'Property, Plant & Equipment',  'asset'),
  -- Liabilities
  ('200001001', 'Accounts Payable',             'liability'),
  ('210001001', 'VAT Payable',                  'liability'),
  ('220001001', 'Withholding Tax Payable',      'liability'),
  ('230001001', 'Loans Payable',                'liability'),
  -- Equity
  ('300001001', 'Owner''s Capital',             'equity'),
  ('310001001', 'Retained Earnings',            'equity'),
  -- Revenue
  ('400001001', 'Clean Water Systems Revenue',  'revenue'),
  ('401001001', 'Solar Systems Revenue',        'revenue'),
  ('402001001', 'Installation & Service Revenue','revenue'),
  ('403001001', 'Maintenance Revenue',          'revenue'),
  ('404001001', 'Other Operating Revenue',      'revenue'),
  -- Project / direct costs
  ('500001001', 'Project Materials',            'expense'),
  ('501001001', 'Project Labour',               'expense'),
  ('502001001', 'Subcontractor Costs',          'expense'),
  ('503001001', 'Equipment Rental',             'expense'),
  ('504001001', 'Transport & Logistics',        'expense'),
  ('505001001', 'Site & Installation Costs',    'expense'),
  -- General & administrative
  ('600001001', 'Salaries & Wages',             'expense'),
  ('601001001', 'Office Rent',                  'expense'),
  ('602001001', 'Utilities',                    'expense'),
  ('603001001', 'Office Supplies',              'expense'),
  ('604001001', 'Professional Fees',            'expense'),
  ('605001001', 'Bank Charges',                 'expense'),
  ('606001001', 'Depreciation',                 'expense'),
  -- Selling
  ('700001001', 'Marketing & Advertising',      'expense'),
  ('701001001', 'Sales Commission',             'expense')
on conflict (code) do nothing;
