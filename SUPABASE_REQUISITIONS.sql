-- Run in Supabase SQL Editor (project rajnrkgcisgpxtzzfmcl)
-- Extra tables for requisitions + finance integrity helpers

create table if not exists public.requisitions (
  id text primary key,
  tenant_id uuid references public.tenants(id),
  req_no text,
  request_date date,
  requester text,
  requester_email text,
  employee text,
  branch text,
  module text,
  priority text default 'Low',
  requested_to text,
  reason text default '',
  description text default '',
  required_date date,
  estimated_cost numeric default 0,
  status text default 'Draft',
  approved_by text,
  approved_date timestamptz,
  rejected_by text,
  rejected_date timestamptz,
  rejected_reason text,
  comments text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  is_deleted text default 'No'
);

create table if not exists public.requisition_items (
  id text primary key,
  requisition_id text references public.requisitions(id) on delete cascade,
  item text,
  description text default '',
  quantity numeric default 0,
  unit text default 'PCS',
  estimated_price numeric default 0,
  total numeric default 0
);

create table if not exists public.requisition_audit_trail (
  id text primary key,
  requisition_id text,
  action text,
  user_name text,
  timestamp timestamptz default now(),
  notes text,
  old_value text,
  new_value text
);

create index if not exists idx_requisitions_status on public.requisitions(status);
create index if not exists idx_requisition_items_req on public.requisition_items(requisition_id);

alter table public.requisitions enable row level security;
alter table public.requisition_items enable row level security;
alter table public.requisition_audit_trail enable row level security;

drop policy if exists requisitions_all on public.requisitions;
create policy requisitions_all on public.requisitions for all using (true) with check (true);
drop policy if exists requisition_items_all on public.requisition_items;
create policy requisition_items_all on public.requisition_items for all using (true) with check (true);
drop policy if exists requisition_audit_all on public.requisition_audit_trail;
create policy requisition_audit_all on public.requisition_audit_trail for all using (true) with check (true);

grant all on public.requisitions to anon, authenticated, service_role;
grant all on public.requisition_items to anon, authenticated, service_role;
grant all on public.requisition_audit_trail to anon, authenticated, service_role;

-- Ensure erp_state bridge row exists
insert into public.erp_state (id, data, updated_at)
values ('farmtrack-demo', '{}'::jsonb, now())
on conflict (id) do nothing;
