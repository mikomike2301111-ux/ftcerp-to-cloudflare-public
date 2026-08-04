-- Farmtrack ERP — HR departments + inventory additions (fixed for existing schema)
-- Project: https://supabase.com/dashboard/project/rajnrkgcisgpxtzzfmcl
-- inventory_items already uses warehouse_id; we add warehouse_name safely.

-- Departments
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

alter table if exists public.employees
  add column if not exists department text,
  add column if not exists department_id uuid,
  add column if not exists position text,
  add column if not exists salary numeric default 0,
  add column if not exists status text default 'Active';

create index if not exists employees_department_idx on public.employees (department);

-- Products (if not already present)
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

-- inventory_items may already exist with warehouse_id — only add missing text cols
alter table if exists public.inventory_items
  add column if not exists warehouse_name text,
  add column if not exists product_name text,
  add column if not exists sku text,
  add column if not exists status text default 'Active';

-- Backfill warehouse_name from warehouses when possible
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'warehouses') then
    update public.inventory_items i
    set warehouse_name = coalesce(i.warehouse_name, w.name, 'Main Store Njiru')
    from public.warehouses w
    where i.warehouse_id = w.id
      and (i.warehouse_name is null or i.warehouse_name = '');
  end if;
  update public.inventory_items
  set warehouse_name = 'Main Store Njiru'
  where warehouse_name is null or warehouse_name = '';
exception when undefined_table then
  null;
end $$;

create or replace view public.analytics_department_headcount as
select
  coalesce(nullif(trim(department), ''), 'Unassigned') as department,
  count(*)::int as headcount,
  count(*) filter (where status = 'Active')::int as active_count
from public.employees
group by 1;

drop view if exists public.analytics_inventory_by_warehouse;
create view public.analytics_inventory_by_warehouse as
select
  coalesce(nullif(trim(warehouse_name), ''), 'Main Store Njiru') as warehouse_name,
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
