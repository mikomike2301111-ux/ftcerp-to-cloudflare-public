-- =============================================================================
-- Farmtrack Biosciences Ltd — FULL Supabase Schema (production)
-- Matches NORMALIZED_TABLES + erp_state shape used by api/rpc.js
-- Run in Supabase SQL Editor (paste entire file once)
-- Safe to re-run: uses IF NOT EXISTS / DROP MATERIALIZED VIEW IF EXISTS
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ─── TENANCY & IDENTITY ──────────────────────────────────────────────────────
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Farmtrack Biosciences Ltd',
  domain text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key,
  tenant_id uuid references public.tenants(id),
  email text unique,
  full_name text,
  role text not null default 'staff',
  department text,
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- JSON bridge used by the ERP (api writes: id, data, updated_at)
create table if not exists public.erp_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
-- Compat if older schema used "state"
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='erp_state' and column_name='state'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='erp_state' and column_name='data'
  ) then
    alter table public.erp_state rename column state to data;
  end if;
exception when others then null;
end $$;

-- ─── MASTER DATA ─────────────────────────────────────────────────────────────
create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  code text,
  name text not null,
  location text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  name text not null,
  code text,
  manager_name text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  external_id text,
  name text not null,
  email text,
  phone text,
  city text,
  county text,
  address text,
  customer_type text default 'customer',
  sales_owner text,
  sales_person text,
  credit_limit numeric default 0,
  balance numeric default 0,
  status text default 'Active',
  category text,
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_customers_name on public.customers (lower(name));
create index if not exists idx_customers_sales_owner on public.customers (sales_owner);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  name text not null,
  email text,
  phone text,
  city text,
  status text default 'Active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  sku text,
  name text not null,
  category text,
  unit text default 'PCS',
  cost_price numeric default 0,
  selling_price numeric default 0,
  min_stock numeric default 0,
  is_active boolean default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists idx_products_sku on public.products (sku) where sku is not null;

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id),
  warehouse_id uuid references public.warehouses(id),
  quantity numeric default 0,
  reserved numeric default 0,
  unit_cost numeric default 0,
  batch_no text,
  expiry_date date,
  updated_at timestamptz default now()
);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id),
  warehouse_id uuid references public.warehouses(id),
  txn_type text,
  quantity numeric not null,
  unit_cost numeric default 0,
  reference_type text,
  reference_id text,
  notes text,
  created_by text,
  created_at timestamptz default now()
);

-- ─── SALES / CRM ─────────────────────────────────────────────────────────────
create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id),
  sale_no text,
  customer_id uuid references public.customers(id),
  customer_name text,
  order_date date default current_date,
  subtotal numeric default 0,
  tax numeric default 0,
  total numeric default 0,
  paid numeric default 0,
  balance numeric default 0,
  status text default 'Open',
  delivery_status text,
  sales_owner text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid references public.sales_orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text,
  quantity numeric default 0,
  unit_price numeric default 0,
  cost numeric default 0,
  total numeric default 0
);

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  quote_no text,
  customer_id uuid references public.customers(id),
  customer_name text,
  total numeric default 0,
  status text default 'Draft',
  approval_status text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  company text,
  email text,
  phone text,
  stage text default 'New',
  status text default 'Active',
  value numeric default 0,
  sales_owner text,
  created_at timestamptz default now()
);

create table if not exists public.crm_calls (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id),
  customer_name text,
  phone text,
  stage text,
  notes text,
  comments text,
  follow_up_date date,
  assigned_to text,
  sales_owner text,
  outcome text,
  call_date date default current_date,
  created_at timestamptz default now()
);

create table if not exists public.crm_followups (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id),
  customer_name text,
  follow_up_date date,
  comments text,
  stage text,
  assigned_to text,
  created_at timestamptz default now()
);

create table if not exists public.crm_visits (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  salesperson text,
  visit_date date,
  purpose text,
  outcome text,
  location text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  delivery_no text,
  sale_id uuid references public.sales_orders(id),
  customer_id uuid references public.customers(id),
  customer_name text,
  status text default 'Pending',
  delivery_method text,
  destination text,
  notes text,
  note_history jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── ACCOUNTS / FINANCE ──────────────────────────────────────────────────────
create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text not null,
  account_type text,
  balance numeric default 0,
  is_active boolean default true
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  inv_no text,
  sale_id uuid,
  customer_id uuid references public.customers(id),
  customer_name text,
  invoice_date date default current_date,
  due_date date,
  subtotal numeric default 0,
  tax numeric default 0,
  total numeric default 0,
  paid numeric default 0,
  balance numeric default 0,
  status text default 'Draft',
  invoice_type text default 'Sales',
  shipping_address text,
  billing_address text,
  terms text,
  notes text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  product_name text,
  quantity numeric default 0,
  unit_price numeric default 0,
  total numeric default 0
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  payment_no text,
  customer_id uuid references public.customers(id),
  customer_name text,
  invoice_id uuid references public.invoices(id),
  amount numeric default 0,
  method text,
  payment_date date default current_date,
  created_at timestamptz default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  exp_no text,
  category text,
  description text,
  amount numeric default 0,
  expense_date date default current_date,
  payment_method text,
  status text default 'Paid',
  created_at timestamptz default now()
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_no text,
  entry_date date default current_date,
  description text,
  reference text,
  approval_status text default 'Draft',
  source_module text,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid references public.journal_entries(id) on delete cascade,
  account_id uuid references public.finance_accounts(id),
  account_name text,
  debit numeric default 0,
  credit numeric default 0,
  memo text
);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bank_name text,
  account_number text,
  currency text default 'KES',
  balance numeric default 0,
  is_active boolean default true
);

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid references public.bank_accounts(id),
  txn_date date default current_date,
  description text,
  amount numeric default 0,
  txn_type text,
  reference text,
  created_at timestamptz default now()
);

create table if not exists public.accounts_receivable (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id),
  invoice_id uuid references public.invoices(id),
  amount numeric default 0,
  balance numeric default 0,
  due_date date,
  status text,
  created_at timestamptz default now()
);

create table if not exists public.accounts_payable (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id),
  reference text,
  amount numeric default 0,
  balance numeric default 0,
  due_date date,
  status text,
  created_at timestamptz default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_no text,
  supplier_id uuid references public.suppliers(id),
  supplier_name text,
  order_date date default current_date,
  expected_date date,
  total numeric default 0,
  status text default 'Open',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ─── MANUFACTURING ───────────────────────────────────────────────────────────
create table if not exists public.raw_materials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id),
  name text,
  unit text,
  qty_on_hand numeric default 0,
  created_at timestamptz default now()
);

create table if not exists public.production_jobs (
  id uuid primary key default gen_random_uuid(),
  job_no text,
  product_id uuid references public.products(id),
  product_name text,
  quantity numeric default 0,
  status text default 'Planned',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.production_batches (
  id uuid primary key default gen_random_uuid(),
  production_job_id uuid references public.production_jobs(id),
  batch_no text,
  quantity numeric default 0,
  status text,
  created_at timestamptz default now()
);

create table if not exists public.material_consumption (
  id uuid primary key default gen_random_uuid(),
  production_job_id uuid references public.production_jobs(id),
  product_id uuid references public.products(id),
  quantity numeric default 0,
  created_at timestamptz default now()
);

create table if not exists public.production_material_requests (
  id uuid primary key default gen_random_uuid(),
  production_job_id uuid references public.production_jobs(id),
  product_id uuid references public.products(id),
  quantity numeric default 0,
  status text default 'Pending',
  created_at timestamptz default now()
);

-- ─── HR / LEAVES ─────────────────────────────────────────────────────────────
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_no text,
  first_name text,
  middle_name text,
  last_name text,
  gender text,
  date_of_birth date,
  national_id text,
  personal_email text,
  company_email text,
  phone text,
  department_id uuid references public.departments(id),
  job_title text,
  hire_date date,
  contract_end date,
  status text default 'Active',
  basic_salary numeric default 0,
  hourly_rate numeric default 0,
  manager_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id),
  work_date date default current_date,
  check_in text,
  check_out text,
  hours_worked numeric default 0,
  status text,
  created_at timestamptz default now()
);

create table if not exists public.leave_applications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id),
  leave_type text,
  start_date date,
  end_date date,
  days numeric default 0,
  status text default 'Pending',
  reason text,
  approver_notes text,
  created_at timestamptz default now()
);

-- ─── OPS ─────────────────────────────────────────────────────────────────────
create table if not exists public.requisitions (
  id uuid primary key default gen_random_uuid(),
  req_no text,
  module text,
  requested_by text,
  status text default 'Pending',
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  title text,
  body text,
  module text,
  is_read boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.spreadsheet_connections (
  id uuid primary key default gen_random_uuid(),
  name text,
  sheet_id text,
  module text,
  config jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.spreadsheet_sync_logs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references public.spreadsheet_connections(id),
  status text,
  message text,
  created_at timestamptz default now()
);

create table if not exists public.business_events (
  id uuid primary key default gen_random_uuid(),
  event_type text,
  module text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor text,
  action text,
  module text,
  entity_type text,
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz default now()
);

-- ─── SEED TENANT + EMPTY STATE ROW ───────────────────────────────────────────
insert into public.tenants (id, name, domain)
values ('00000000-0000-0000-0000-000000000001', 'Farmtrack Biosciences Ltd', 'staff.farmtrack.co.ke')
on conflict do nothing;

insert into public.erp_state (id, data, updated_at)
values ('farmtrack-demo', '{}'::jsonb, now())
on conflict (id) do nothing;

-- ─── ANALYTICS MATERIALIZED VIEWS ────────────────────────────────────────────
drop materialized view if exists public.analytics_revenue_summary cascade;
create materialized view public.analytics_revenue_summary as
select
  date_trunc('month', coalesce(order_date, created_at::date))::date as period,
  coalesce(sum(total),0) as revenue,
  coalesce(sum(paid),0) as collected,
  count(*)::int as order_count
from public.sales_orders
group by 1
order by 1 desc;

drop materialized view if exists public.analytics_inventory_health cascade;
create materialized view public.analytics_inventory_health as
select
  p.id as product_id,
  p.name as product_name,
  p.sku,
  coalesce(sum(i.quantity),0) as on_hand,
  coalesce(sum(i.reserved),0) as reserved,
  coalesce(p.min_stock,0) as min_stock
from public.products p
left join public.inventory_items i on i.product_id = p.id
group by p.id, p.name, p.sku, p.min_stock;

drop materialized view if exists public.analytics_customer_value cascade;
create materialized view public.analytics_customer_value as
select
  c.id as customer_id,
  c.name as customer_name,
  c.sales_owner,
  coalesce(sum(s.total),0) as lifetime_value,
  count(s.id)::int as order_count
from public.customers c
left join public.sales_orders s on s.customer_id = c.id
group by c.id, c.name, c.sales_owner;

drop materialized view if exists public.analytics_executive_summary cascade;
create materialized view public.analytics_executive_summary as
select
  (select coalesce(sum(total),0) from public.sales_orders) as total_revenue,
  (select coalesce(sum(balance),0) from public.invoices) as open_receivables,
  (select coalesce(sum(quantity * unit_cost),0) from public.inventory_items) as inventory_value,
  (select count(*) from public.customers) as customer_count,
  now() as refreshed_at;

drop materialized view if exists public.analytics_procurement_metrics cascade;
create materialized view public.analytics_procurement_metrics as
select status, count(*)::int as cnt, coalesce(sum(total),0) as value
from public.purchase_orders group by status;

drop materialized view if exists public.analytics_production_metrics cascade;
create materialized view public.analytics_production_metrics as
select status, count(*)::int as cnt, coalesce(sum(quantity),0) as qty
from public.production_jobs group by status;

drop materialized view if exists public.analytics_risk_center cascade;
create materialized view public.analytics_risk_center as
select 'low_stock'::text as risk_type, p.name as label, coalesce(sum(i.quantity),0) as metric
from public.products p
left join public.inventory_items i on i.product_id = p.id
group by p.id, p.name, p.min_stock
having coalesce(sum(i.quantity),0) <= coalesce(p.min_stock,0)
limit 50;

-- ─── RLS (open for service role; tighten later per role) ─────────────────────
alter table public.erp_state enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.invoices enable row level security;

do $$ begin
  create policy erp_state_all on public.erp_state for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy customers_all on public.customers for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy products_all on public.products for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy invoices_all on public.invoices for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

-- Grant API roles
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant select on all materialized views in schema public to anon, authenticated, service_role;

-- =============================================================================
-- END. After running: set Vercel SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY / ANON
-- STATE_ID used by app: farmtrack-demo
-- =============================================================================
