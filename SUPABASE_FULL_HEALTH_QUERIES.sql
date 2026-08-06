-- FarmTrack ERP — full health queries (run in Supabase SQL Editor)
-- Project: https://rajnrkgcisgpxtzzfmcl.supabase.co

-- 1) Core erp_state presence + sizes
select
  id,
  updated_at,
  pg_column_size(data) as data_bytes,
  jsonb_typeof(data) as data_type
from public.erp_state
where id = 'farmtrack-demo';

-- 2) All major module counts from JSON state
select
  jsonb_array_length(coalesce(data->'users','[]'::jsonb)) as users,
  jsonb_array_length(coalesce(data->'customers','[]'::jsonb)) as customers,
  jsonb_array_length(coalesce(data->'products','[]'::jsonb)) as products,
  jsonb_array_length(coalesce(data->'inventory','[]'::jsonb)) as inventory,
  jsonb_array_length(coalesce(data->'sales','[]'::jsonb)) as sales,
  jsonb_array_length(coalesce(data->'saleItems','[]'::jsonb)) as sale_items,
  jsonb_array_length(coalesce(data->'invoices','[]'::jsonb)) as invoices,
  jsonb_array_length(coalesce(data->'expenses','[]'::jsonb)) as expenses,
  jsonb_array_length(coalesce(data->'employees','[]'::jsonb)) as employees,
  jsonb_array_length(coalesce(data->'leaveApplications','[]'::jsonb)) as leave_apps,
  jsonb_array_length(coalesce(data->'visits','[]'::jsonb)) as visits,
  jsonb_array_length(coalesce(data->'salesVisits','[]'::jsonb)) as sales_visits,
  jsonb_array_length(coalesce(data->'leads','[]'::jsonb)) as leads,
  jsonb_array_length(coalesce(data->'calls','[]'::jsonb)) as calls,
  jsonb_array_length(coalesce(data->'purchaseOrders','[]'::jsonb)) as purchase_orders,
  jsonb_array_length(coalesce(data->'goodsReceipts','[]'::jsonb)) as grns,
  jsonb_array_length(coalesce(data->'requisitions','[]'::jsonb)) as requisitions,
  jsonb_array_length(coalesce(data->'loginAuditLogs','[]'::jsonb)) as login_logs,
  jsonb_array_length(coalesce(data->'financeAuditLogs','[]'::jsonb)) as finance_audits,
  updated_at
from public.erp_state
where id = 'farmtrack-demo';

-- 3) Users & roles
select
  u->>'name' as name,
  u->>'email' as email,
  u->>'role' as role,
  u->>'status' as status,
  u->>'department' as department,
  u->>'lastLogin' as last_login
from public.erp_state,
  jsonb_array_elements(coalesce(data->'users','[]'::jsonb)) u
where id = 'farmtrack-demo'
order by u->>'role', u->>'name';

-- 4) Recent login security events
select
  a->>'createdAt' as at,
  a->>'email' as email,
  a->>'status' as status,
  a->>'device' as device,
  a->>'timezone' as timezone,
  left(a->>'userAgent', 80) as browser
from public.erp_state,
  jsonb_array_elements(coalesce(data->'loginAuditLogs','[]'::jsonb)) a
where id = 'farmtrack-demo'
order by a->>'createdAt' desc
limit 30;

-- 5) Sales snapshot (for Analytics cross-check)
select
  s->>'saleNo' as sale_no,
  s->>'customerName' as customer,
  s->>'total' as total,
  s->>'date' as date,
  s->>'status' as status
from public.erp_state,
  jsonb_array_elements(coalesce(data->'sales','[]'::jsonb)) s
where id = 'farmtrack-demo'
order by s->>'date' desc nulls last
limit 20;

-- 6) Inventory sample
select
  i->>'productName' as product,
  i->>'quantity' as qty,
  i->>'warehouse' as warehouse,
  i->>'status' as status
from public.erp_state,
  jsonb_array_elements(coalesce(data->'inventory','[]'::jsonb)) i
where id = 'farmtrack-demo'
limit 25;

-- 7) Normalized table existence + counts
do $$
declare
  t text;
  n bigint;
  tables text[] := array[
    'erp_state','customers','products','inventory_items','warehouses',
    'sales_orders','invoices','payments','goods_receipts','employees',
    'requisitions','requisition_items'
  ];
begin
  raise notice '=== TABLE COUNTS ===';
  foreach t in array tables loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('select count(*) from public.%I', t) into n;
      raise notice '% : %', t, n;
    else
      raise notice '% : MISSING', t;
    end if;
  end loop;
end $$;

-- 8) Write probe
update public.erp_state
set updated_at = now()
where id = 'farmtrack-demo'
returning id, updated_at;

-- 9) Health badge
select
  case when exists (select 1 from public.erp_state where id='farmtrack-demo') then 'OK' else 'FAIL' end as erp_state,
  case when (
    select jsonb_array_length(coalesce(data->'products','[]'::jsonb)) from public.erp_state where id='farmtrack-demo'
  ) > 0 then 'OK' else 'WARN' end as products,
  case when (
    select jsonb_array_length(coalesce(data->'users','[]'::jsonb)) from public.erp_state where id='farmtrack-demo'
  ) > 0 then 'OK' else 'WARN' end as users,
  now() as checked_at;
