-- Farmtrack ERP — HR departments + inventory product additions
-- Run in Supabase SQL editor (project rajnrkgcisgpxtzzfmcl)

-- Departments (normalized)
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  name text not null,
  code text,
  manager text,
  description text,
  budget numeric default 0,
  location text,
  cost_center text,
  parent_department text,
  status text default 'Active',
  headcount int default 0,
  members int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists departments_name_uidx on public.departments (lower(name));

-- Employee department assignment is on employees.department (text) + optional department_id
alter table if exists public.employees
  add column if not exists department text,
  add column if not exists department_id uuid references public.departments(id) on delete set null,
  add column if not exists position text,
  add column if not exists salary numeric default 0,
  add column if not exists status text default 'Active';

create index if not exists employees_department_idx on public.employees (department);

-- Products + inventory stock lines
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  name text not null,
  sku text,
  category text,
  unit text default 'pcs',
  cost_price numeric default 0,
  selling_price numeric default 0,
  min_stock numeric default 0,
  supplier_name text,
  status text default 'Active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists products_sku_uidx on public.products (sku) where sku is not null and sku <> '';

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  product_id uuid references public.products(id) on delete cascade,
  product_name text,
  sku text,
  warehouse_name text default 'Main Store Njiru',
  quantity numeric default 0,
  unit_cost numeric default 0,
  quantity_reserved numeric default 0,
  quantity_incoming numeric default 0,
  quantity_outgoing numeric default 0,
  status text default 'Active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists inventory_items_product_idx on public.inventory_items (product_id);
create index if not exists inventory_items_warehouse_idx on public.inventory_items (warehouse_name);

-- Analytics helper views
create or replace view public.analytics_department_headcount as
select
  coalesce(nullif(trim(department), ''), 'Unassigned') as department,
  count(*)::int as headcount,
  count(*) filter (where status = 'Active')::int as active_count
from public.employees
group by 1;

create or replace view public.analytics_inventory_by_warehouse as
select
  coalesce(warehouse_name, 'Main Store Njiru') as warehouse_name,
  count(*)::int as sku_count,
  coalesce(sum(quantity), 0) as total_qty,
  coalesce(sum(quantity * unit_cost), 0) as stock_value
from public.inventory_items
group by 1;

grant select on public.analytics_department_headcount to anon, authenticated, service_role;
grant select on public.analytics_inventory_by_warehouse to anon, authenticated, service_role;
grant all on public.departments to service_role;
grant all on public.products to service_role;
grant all on public.inventory_items to service_role;
