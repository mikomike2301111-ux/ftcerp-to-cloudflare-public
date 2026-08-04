-- Farmtrack ERP — CRM pipeline + analytics tables
-- Project: https://supabase.com/dashboard/project/rajnrkgcisgpxtzzfmcl

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  name text not null,
  company text,
  phone text,
  email text,
  stage text default 'New',
  status text default 'Active',
  value numeric default 0,
  assigned_to text,
  source text default 'Manual',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  record_type text default 'call', -- call | followup | reception
  customer_id uuid,
  customer_name text,
  phone text,
  stage text,
  notes text,
  comments text,
  follow_up_date date,
  assigned_to text,
  transferred_to text,
  received_by text,
  sales_owner text,
  outcome text,
  call_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  name text not null,
  type text default 'Customer',
  phone text,
  email text,
  city text,
  county text,
  sales_owner text,
  sales_person text,
  status text default 'Active',
  credit_limit numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table if exists public.leads
  add column if not exists stage text default 'New',
  add column if not exists value numeric default 0,
  add column if not exists assigned_to text,
  add column if not exists source text default 'Manual';

alter table if exists public.calls
  add column if not exists record_type text default 'call',
  add column if not exists comments text,
  add column if not exists follow_up_date date,
  add column if not exists transferred_to text,
  add column if not exists received_by text,
  add column if not exists sales_owner text;

alter table if exists public.customers
  add column if not exists sales_owner text,
  add column if not exists sales_person text,
  add column if not exists type text default 'Customer';

create index if not exists leads_stage_idx on public.leads (stage);
create index if not exists calls_record_type_idx on public.calls (record_type);
create index if not exists customers_sales_owner_idx on public.customers (sales_owner);

create or replace view public.analytics_crm_pipeline as
select
  coalesce(nullif(trim(stage), ''), 'New') as stage,
  count(*)::int as opportunities,
  coalesce(sum(value), 0) as pipeline_value
from public.leads
where coalesce(status, 'Active') <> 'Deleted'
group by 1;

create or replace view public.analytics_crm_calls as
select
  coalesce(record_type, 'call') as record_type,
  count(*)::int as total,
  count(*) filter (where follow_up_date is not null)::int as with_followup
from public.calls
group by 1;

grant select on public.analytics_crm_pipeline to anon, authenticated, service_role;
grant select on public.analytics_crm_calls to anon, authenticated, service_role;
grant all on public.leads to service_role;
grant all on public.calls to service_role;
grant all on public.customers to service_role;
