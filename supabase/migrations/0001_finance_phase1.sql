-- ===========================================================================
-- Ever Spark ERP — Finance Module, Phase 1 schema
-- Run once in the Supabase SQL editor (or save under supabase/migrations/).
-- Idempotent: safe to re-run. ETB-only in Phase 1; `currency` column kept for later.
-- ===========================================================================

-- gen_random_uuid() — available by default on Supabase (pgcrypto).
create extension if not exists pgcrypto;

-- ---------- enums (idempotent) ----------
do $$ begin
  create type payment_status as enum
    ('draft','submitted','clarification','approved','rejected','processing','paid','posted','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method as enum ('bank_transfer','check','telebirr','petty_cash','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_kind as enum
    ('proforma','invoice','receipt','grn','pra','bpv','bank_advice','contract','other');
exception when duplicate_object then null; end $$;

-- ---------- reference / configuration tables ----------
create table if not exists cost_centers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                -- 9-digit COA code, no spaces
  name text not null,
  class text not null,                      -- asset|liability|equity|revenue|cost|expense|other|control
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tin text,
  bank_name text,
  bank_account text,
  phone text,
  email text,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists approval_thresholds (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                       -- 'payment' | 'credit'
  min_amount numeric(14,2) not null default 0,
  max_amount numeric(14,2),                 -- null = no upper bound
  required_role text not null,              -- 'finance' | 'admin'
  requires_check boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- extend existing projects with money ----------
alter table projects add column if not exists budget numeric(14,2);
alter table projects add column if not exists cost_center_id uuid references cost_centers(id);
alter table projects add column if not exists project_coa_code text;

-- ---------- core: payment requests (the manual's PRA) ----------
create sequence if not exists pr_seq start 1;

create table if not exists payment_requests (
  id uuid primary key default gen_random_uuid(),
  reference text unique,                    -- set by trigger: PR-YYYY-000123
  requester_id uuid not null references profiles(id),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'ETB',
  purpose text not null,
  vendor_id uuid references vendors(id),
  project_id uuid references projects(id),
  cost_center_id uuid references cost_centers(id),
  coa_code text references chart_of_accounts(code),
  payment_method payment_method,
  requires_check boolean not null default false,
  is_project_related boolean not null default false,
  status payment_status not null default 'submitted',
  current_approver_role text,
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  rejected_reason text,
  paid_by uuid references profiles(id),
  paid_at timestamptz,
  bpv_number text,
  bank_advice_ref text,
  posted_by uuid references profiles(id),
  posted_at timestamptz,
  external_journal_ref text,                -- reserved for a future Xero/QuickBooks id
  source_channel text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pr_status      on payment_requests (status);
create index if not exists idx_pr_project     on payment_requests (project_id);
create index if not exists idx_pr_requester   on payment_requests (requester_id);
create index if not exists idx_pr_created     on payment_requests (created_at desc);

create table if not exists payment_documents (
  id uuid primary key default gen_random_uuid(),
  payment_request_id uuid not null references payment_requests(id) on delete cascade,
  kind document_kind not null,
  url text not null,                        -- storage PATH in the private bucket (served via signed URL)
  file_name text not null,
  uploaded_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_pdoc_request on payment_documents (payment_request_id);

-- append-only audit trail
create table if not exists payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_request_id uuid not null references payment_requests(id) on delete cascade,
  actor_id uuid not null references profiles(id),
  action text not null,
  from_status payment_status,
  to_status payment_status,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists idx_pevt_request on payment_events (payment_request_id, created_at);

-- ===========================================================================
-- Triggers
-- ===========================================================================

-- 1) On insert: assign serial reference + requires_check + route to approver tier.
create or replace function finance_set_payment_routing()
returns trigger language plpgsql as $$
declare v_role text;
begin
  if new.reference is null then
    new.reference := 'PR-' || to_char(now(),'YYYY') || '-' || lpad(nextval('pr_seq')::text, 6, '0');
  end if;
  new.requires_check := coalesce(new.amount, 0) > 30000;   -- manual: >30k must be by check
  select required_role into v_role
    from approval_thresholds
   where kind = 'payment'
     and new.amount >= min_amount
     and (max_amount is null or new.amount <= max_amount)
   order by min_amount desc
   limit 1;
  new.current_approver_role := coalesce(v_role, 'admin');
  return new;
end $$;

drop trigger if exists trg_payment_routing on payment_requests;
create trigger trg_payment_routing
  before insert on payment_requests
  for each row execute function finance_set_payment_routing();

-- 2) touch updated_at
create or replace function finance_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_pr_touch on payment_requests;
create trigger trg_pr_touch
  before update on payment_requests
  for each row execute function finance_touch_updated_at();

-- 3) HARD GATE: cannot move to 'paid' without a supporting document.
create or replace function enforce_receipt_before_paid()
returns trigger language plpgsql as $$
begin
  if new.status = 'paid' and old.status <> 'paid' then
    if not exists (
      select 1 from payment_documents d
       where d.payment_request_id = new.id
         and d.kind in ('receipt','invoice','bpv','bank_advice')
    ) then
      raise exception 'Cannot mark PAID: no supporting document attached (receipt/invoice/bpv/bank_advice required)';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_receipt_gate on payment_requests;
create trigger trg_receipt_gate
  before update on payment_requests
  for each row execute function enforce_receipt_before_paid();

-- ===========================================================================
-- Row-Level Security
-- Note: API routes perform privileged writes with the service-role key (which
-- bypasses RLS) exactly like the existing Leave module. These policies govern
-- any direct (anon-key) client access and are the safety net.
-- ===========================================================================

alter table cost_centers       enable row level security;
alter table chart_of_accounts  enable row level security;
alter table vendors            enable row level security;
alter table approval_thresholds enable row level security;
alter table payment_requests   enable row level security;
alter table payment_documents  enable row level security;
alter table payment_events     enable row level security;

-- helper: current user's role
create or replace function finance_is_staff() returns boolean
language sql stable as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('finance','admin'));
$$;

-- reference tables: readable by any authenticated user; writable by finance/admin
do $$ declare t text;
begin
  foreach t in array array['cost_centers','chart_of_accounts','vendors','approval_thresholds'] loop
    execute format('drop policy if exists %I_select on %I', t, t);
    execute format('create policy %I_select on %I for select using (auth.uid() is not null)', t, t);
    execute format('drop policy if exists %I_write on %I', t, t);
    execute format('create policy %I_write on %I for all using (finance_is_staff()) with check (finance_is_staff())', t, t);
  end loop;
end $$;

-- payment_requests
drop policy if exists pr_select on payment_requests;
create policy pr_select on payment_requests for select
  using (requester_id = auth.uid() or finance_is_staff());

drop policy if exists pr_insert on payment_requests;
create policy pr_insert on payment_requests for insert
  with check (requester_id = auth.uid());

drop policy if exists pr_update on payment_requests;
create policy pr_update on payment_requests for update
  using (finance_is_staff());

-- payment_documents
drop policy if exists pdoc_select on payment_documents;
create policy pdoc_select on payment_documents for select using (
  finance_is_staff() or exists (
    select 1 from payment_requests r
     where r.id = payment_request_id and r.requester_id = auth.uid()
  )
);
drop policy if exists pdoc_insert on payment_documents;
create policy pdoc_insert on payment_documents for insert
  with check (uploaded_by = auth.uid());

-- payment_events: append-only (no update/delete policies => denied)
drop policy if exists pevt_select on payment_events;
create policy pevt_select on payment_events for select using (
  finance_is_staff() or exists (
    select 1 from payment_requests r
     where r.id = payment_request_id and r.requester_id = auth.uid()
  )
);
drop policy if exists pevt_insert on payment_events;
create policy pevt_insert on payment_events for insert
  with check (actor_id = auth.uid());

-- ===========================================================================
-- Private storage bucket for receipts (served via signed URLs only)
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('payment-documents', 'payment-documents', false)
on conflict (id) do nothing;

-- ===========================================================================
-- Seed data
-- ===========================================================================

insert into cost_centers (code, name) values
  ('ADMIN','Administration & Finance'),
  ('OPS','Operations & Service'),
  ('SALES','Sales & Marketing'),
  ('PROJ','Projects')
on conflict (code) do nothing;

-- DOA tiers from the manual (payments: >30k must be check; credit threshold 100k)
insert into approval_thresholds (kind, min_amount, max_amount, required_role, requires_check) values
  ('payment',      0.00,   50000.00, 'finance', false),
  ('payment',  50000.01,       null, 'admin',   true),
  ('credit',       0.00,  100000.00, 'finance', false),
  ('credit',  100000.01,       null, 'admin',   false)
on conflict do nothing;

-- Chart of accounts — representative subset from the Finance Manual.
insert into chart_of_accounts (code, name, class) values
  -- assets
  ('110001001','Cash on Hand','asset'),
  ('110002001','Bank - Operational Account','asset'),
  ('111001001','Trade Receivables - Water Treatment Projects','asset'),
  ('111002001','Trade Receivables - Product Sales','asset'),
  ('112001001','Inventory - Water Treatment Chemicals','asset'),
  ('112002001','Inventory - Spare Parts','asset'),
  ('113001001','Prepayments - Suppliers','asset'),
  ('114001001','Advances to Employees','asset'),
  ('140001001','Plant & Equipment - Water Treatment Systems','asset'),
  ('140002001','Vehicles - Service & Distribution','asset'),
  ('150001001','Intangible Assets - Software/ERP','asset'),
  -- liabilities
  ('210001001','Accounts Payable - Suppliers','liability'),
  ('211001001','VAT Payable','liability'),
  ('211002001','Withholding Tax Payable','liability'),
  ('212001001','Accrued Expenses','liability'),
  ('213001001','Customer Advances (Deferred Revenue)','liability'),
  -- equity
  ('300001001','Share Capital','equity'),
  ('310001001','Retained Earnings','equity'),
  -- revenue
  ('400001001','Revenue - Water Disinfection Systems','revenue'),
  ('401001001','Revenue - Installation Services','revenue'),
  ('402001001','Revenue - Maintenance & Service Contracts','revenue'),
  ('403001001','Revenue - Chemical Sales','revenue'),
  ('404001001','Revenue - Spare Parts Sales','revenue'),
  -- operating costs (project / service related)
  ('500001001','Cost - Water Treatment Equipment','cost'),
  ('501001001','Cost - Chemicals Consumed','cost'),
  ('502001001','Cost - Spare Parts Used','cost'),
  ('503001001','Direct Labor - Installation','cost'),
  ('504001001','Direct Labor - Maintenance','cost'),
  ('505001001','Project Transportation Costs','cost'),
  -- G&A
  ('600001001','Salaries and Wages - Admin Staff','expense'),
  ('601001001','Office Rent','expense'),
  ('602001001','Utilities (Electricity, Water, Internet)','expense'),
  ('603001001','Office Supplies','expense'),
  ('604001001','Depreciation Expense','expense'),
  ('605001001','Professional Fees (Audit, Legal)','expense'),
  ('606001001','Training and Development','expense'),
  -- selling & distribution
  ('700001001','Marketing and Advertising','expense'),
  ('701001001','Sales Commission','expense'),
  ('702001001','Delivery and Transport Expense','expense'),
  ('703001001','Customer Relationship Expenses','expense'),
  -- control
  ('910001001','Project Tracking','control')
on conflict (code) do nothing;

-- Done.
