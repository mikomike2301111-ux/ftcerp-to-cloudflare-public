-- HR + Accounts + Inventory follow-up tests
-- Run on: https://rajnrkgcisgpxtzzfmcl.supabase.co

-- A) Payroll-related state
select
  jsonb_array_length(coalesce(data->'employees','[]'::jsonb)) as employees,
  jsonb_array_length(coalesce(data->'payrollRecords','[]'::jsonb)) as payroll_records,
  jsonb_array_length(coalesce(data->'attendance','[]'::jsonb)) as attendance,
  jsonb_array_length(coalesce(data->'leaveApplications','[]'::jsonb)) as leave_apps,
  jsonb_array_length(coalesce(data->'invoices','[]'::jsonb)) as invoices,
  jsonb_array_length(coalesce(data->'financeAuditLogs','[]'::jsonb)) as finance_audits,
  jsonb_array_length(coalesce(data->'purchaseOrders','[]'::jsonb)) as purchase_orders,
  jsonb_array_length(coalesce(data->'goodsReceipts','[]'::jsonb)) as grns,
  updated_at
from public.erp_state where id = 'farmtrack-demo';

-- B) Sample employees with custom deductions
select
  e->>'name' as name,
  e->>'status' as status,
  e->>'salary' as salary,
  jsonb_array_length(coalesce(e->'customDeductions','[]'::jsonb)) as custom_deductions_n
from public.erp_state,
  jsonb_array_elements(coalesce(data->'employees','[]'::jsonb)) e
where id = 'farmtrack-demo'
limit 20;

-- C) Recent finance audit (if stored in state)
select
  a->>'action' as action,
  a->>'recordType' as record_type,
  a->>'detail' as detail,
  a->>'userName' as user_name,
  a->>'createdAt' as created_at
from public.erp_state,
  jsonb_array_elements(coalesce(data->'financeAuditLogs','[]'::jsonb)) a
where id = 'farmtrack-demo'
order by a->>'createdAt' desc
limit 20;

-- D) Write probe
update public.erp_state set updated_at = now()
where id = 'farmtrack-demo'
returning id, updated_at;
