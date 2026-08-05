-- ═══════════════════════════════════════════════════════════════
-- FarmTrack ERP — FULL SYSTEM TEST (run all in one go)
-- Project should be: https://rajnrkgcisgpxtzzfmcl.supabase.co
-- Paste entire file into Supabase SQL Editor → Run
-- Copy the result grids / messages back for review
-- ═══════════════════════════════════════════════════════════════

-- 0) Project identity
select
  current_database() as database,
  current_user as db_user,
  now() as ran_at;

-- 1) List public tables
select table_name
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;

-- 2) erp_state core (JSON bridge — main ERP memory)
select
  id,
  updated_at,
  pg_column_size(data) as data_bytes,
  (data ? 'customers') as has_customers,
  (data ? 'products') as has_products,
  (data ? 'employees') as has_employees,
  (data ? 'inventory') as has_inventory,
  (data ? 'sales') as has_sales,
  (data ? 'suppliers') as has_suppliers,
  jsonb_array_length(coalesce(data->'customers','[]'::jsonb)) as customers_n,
  jsonb_array_length(coalesce(data->'products','[]'::jsonb)) as products_n,
  jsonb_array_length(coalesce(data->'employees','[]'::jsonb)) as employees_n,
  jsonb_array_length(coalesce(data->'inventory','[]'::jsonb)) as inventory_n,
  jsonb_array_length(coalesce(data->'sales','[]'::jsonb)) as sales_n,
  jsonb_array_length(coalesce(data->'suppliers','[]'::jsonb)) as suppliers_n,
  jsonb_array_length(coalesce(data->'purchaseOrders','[]'::jsonb)) as purchase_orders_n,
  jsonb_array_length(coalesce(data->'invoices','[]'::jsonb)) as invoices_n,
  jsonb_array_length(coalesce(data->'leads','[]'::jsonb)) as leads_n,
  jsonb_array_length(coalesce(data->'calls','[]'::jsonb)) as calls_n,
  jsonb_array_length(coalesce(data->'leaveApplications','[]'::jsonb)) as leave_apps_n,
  jsonb_array_length(coalesce(data->'goodsReceipts','[]'::jsonb)) as grn_n,
  jsonb_array_length(coalesce(data->'production','[]'::jsonb)) as production_n,
  jsonb_array_length(coalesce(data->'requisitions','[]'::jsonb)) as requisitions_n
from public.erp_state
where id = 'farmtrack-demo';

-- 3) Normalized table row counts (0 if table missing — use DO block)
do $$
declare
  t text;
  n bigint;
  tables text[] := array[
    'erp_state','tenants','profiles','customers','suppliers','products',
    'inventory_items','warehouses','sales_orders','invoices','payments',
    'goods_receipts','goods_receipt_items','inventory_transactions',
    'employees','departments','leave_applications','requisitions','requisition_items'
  ];
begin
  raise notice '=== NORMALIZED TABLE COUNTS ===';
  foreach t in array tables loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('select count(*) from public.%I', t) into n;
      raise notice '% : %', t, n;
    else
      raise notice '% : MISSING', t;
    end if;
  end loop;
end $$;

-- 4) Warehouses seed check
select name, code, location, capacity, status
from public.warehouses
order by name;

-- 5) Inventory items sample
select product_name, warehouse_name, quantity, unit_cost, status, updated_at
from public.inventory_items
order by updated_at desc nulls last
limit 20;

-- 6) Customers sample (normalized if exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='customers') then
    raise notice 'customers table exists';
  end if;
end $$;

select * from public.customers order by created_at desc nulls last limit 10;

-- 7) RLS enabled?
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

-- 8) Policies
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 9) Grants for anon / authenticated / service_role on key tables
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
  and table_name in (
    'erp_state','customers','products','inventory_items','warehouses',
    'goods_receipts','sales_orders','invoices'
  )
order by table_name, grantee, privilege_type;

-- 10) Write probe (safe — updates updated_at only, then shows result)
update public.erp_state
set updated_at = now()
where id = 'farmtrack-demo'
returning id, updated_at;

-- 11) Final health summary
select
  case when exists (select 1 from public.erp_state where id = 'farmtrack-demo')
    then 'OK' else 'FAIL' end as erp_state,
  case when exists (select 1 from public.warehouses where name = 'Main Store Njiru')
    then 'OK' else 'WARN' end as main_store,
  case when (
    select jsonb_array_length(coalesce(data->'products','[]'::jsonb))
    from public.erp_state where id = 'farmtrack-demo'
  ) >= 1 then 'OK' else 'FAIL' end as products_in_state,
  case when (
    select jsonb_array_length(coalesce(data->'employees','[]'::jsonb))
    from public.erp_state where id = 'farmtrack-demo'
  ) >= 1 then 'OK' else 'FAIL' end as employees_in_state,
  now() as checked_at;
