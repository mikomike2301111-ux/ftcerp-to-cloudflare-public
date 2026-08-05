-- Inventory receiving + warehouse + suppliers (safe to re-run)
-- Project: rajnrkgcisgpxtzzfmcl

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  name text unique,
  code text,
  location text default 'Njiru',
  capacity numeric default 0,
  used numeric default 0,
  status text default 'Active',
  created_at timestamptz default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  supplier_no text,
  name text,
  email text,
  phone text,
  status text default 'Active',
  created_at timestamptz default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid,
  product_name text,
  sku text,
  warehouse_name text default 'Main Store Njiru',
  batch_no text,
  quantity numeric default 0,
  unit_cost numeric default 0,
  expiry_date date,
  received_date date,
  status text default 'In Stock',
  supplier_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  grn_no text,
  po_no text,
  supplier_name text,
  warehouse_name text,
  delivery_note text,
  received_by text,
  date date,
  status text default 'Received',
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.goods_receipt_items (
  id uuid primary key default gen_random_uuid(),
  grn_id uuid references public.goods_receipts(id) on delete cascade,
  product_name text,
  sku text,
  quantity numeric default 0,
  unit_cost numeric default 0,
  batch_no text,
  expiry_date date,
  condition text default 'Good'
);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  product_name text,
  sku text,
  warehouse_name text,
  batch_no text,
  transaction_type text,
  quantity numeric default 0,
  unit_cost numeric default 0,
  reference_type text,
  reference_id text,
  created_by text,
  notes text,
  created_at timestamptz default now()
);

insert into public.warehouses (name, code, location, capacity, status)
values
  ('Main Store Njiru', 'NJIRU', 'Njiru', 1000000, 'Active'),
  ('Finished Goods Store', 'FG', 'Njiru', 500000, 'Active'),
  ('Raw Materials Store', 'RM', 'Njiru', 500000, 'Active')
on conflict (name) do nothing;

alter table public.warehouses enable row level security;
alter table public.inventory_items enable row level security;
alter table public.goods_receipts enable row level security;
alter table public.goods_receipt_items enable row level security;
alter table public.inventory_transactions enable row level security;

drop policy if exists warehouses_all on public.warehouses;
create policy warehouses_all on public.warehouses for all using (true) with check (true);
drop policy if exists inventory_items_all on public.inventory_items;
create policy inventory_items_all on public.inventory_items for all using (true) with check (true);
drop policy if exists goods_receipts_all on public.goods_receipts;
create policy goods_receipts_all on public.goods_receipts for all using (true) with check (true);
drop policy if exists goods_receipt_items_all on public.goods_receipt_items;
create policy goods_receipt_items_all on public.goods_receipt_items for all using (true) with check (true);
drop policy if exists inventory_transactions_all on public.inventory_transactions;
create policy inventory_transactions_all on public.inventory_transactions for all using (true) with check (true);

grant all on public.warehouses to anon, authenticated, service_role;
grant all on public.inventory_items to anon, authenticated, service_role;
grant all on public.goods_receipts to anon, authenticated, service_role;
grant all on public.goods_receipt_items to anon, authenticated, service_role;
grant all on public.inventory_transactions to anon, authenticated, service_role;
