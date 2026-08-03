-- =============================================================================
-- Farmtrack Biosciences Ltd — Complete Supabase PostgreSQL Schema
-- ERP: Sales · CRM · Inventory · Manufacturing · Accounts · Finance · HR · Leaves
-- Shared customer master with permanent sales_owner tag (Sales ↔ CRM)
-- No demo seed data. Designed for multi-user, long-lived production.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ─── TENANCY & IDENTITY ──────────────────────────────────────────────────────
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Farmtrack Biosciences Ltd',
  domain text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references tenants(id),
  email text unique,
  full_name text,
  role text not null default 'staff'
    check (role in ('admin','manager','sales','field','accountant','hr','inventory','procurement','production','staff')),
  department text,
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- JSON bridge for legacy monolithic state (optional hybrid)
create table if not exists erp_state (
  id text primary key default 'default',
  tenant_id uuid references tenants(id),
  state jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- ─── SHARED MASTER DATA ──────────────────────────────────────────────────────
create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  code text,
  name text not null,
  location text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  code text,
  name text not null,
  manager_name text,
  assistant_manager text,
  description text,
  budget numeric(14,2) default 0,
  office_location text,
  status text not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Customers shared by Sales + CRM. sales_owner is permanent tag of owning sales person.
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  code text,
  name text not null,
  email text,
  phone text,
  alt_phone text,
  city text,
  county text,
  address text,
  customer_type text not null default 'Customer'
    check (customer_type in ('Farm','Agrovet','Broker','Supplier','Customer','Distributor','Other')),
  status text not null default 'Active',
  health text,
  credit_limit numeric(14,2) default 0,
  balance numeric(14,2) default 0,
  revenue numeric(14,2) default 0,
  -- Permanent sales person ownership (shared Sales ↔ CRM)
  sales_owner text,
  sales_owner_user_id uuid references profiles(id),
  sales_person text, -- mirror of sales_owner for legacy reads
  source_module text default 'crm', -- 'sales' | 'crm' | 'import'
  notes text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text
);
create index if not exists idx_customers_sales_owner on customers(sales_owner);
create index if not exists idx_customers_name on customers(name);
create index if not exists idx_customers_type on customers(customer_type);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  name text not null,
  email text,
  phone text,
  city text,
  payment_terms text,
  balance numeric(14,2) default 0,
  status text not null default 'Active',
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  sku text,
  name text not null,
  category text,
  unit text default 'PCS',
  cost_price numeric(14,2) default 0,
  selling_price numeric(14,2) default 0,
  reorder_level numeric(14,2) default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_products_sku on products(tenant_id, sku);

-- ─── INVENTORY ───────────────────────────────────────────────────────────────
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  product_id uuid references products(id),
  warehouse_id uuid references warehouses(id),
  quantity numeric(14,3) not null default 0,
  reserved_qty numeric(14,3) not null default 0,
  avg_cost numeric(14,2) default 0,
  updated_at timestamptz not null default now()
);

create table if not exists inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  product_id uuid references products(id),
  warehouse_id uuid references warehouses(id),
  txn_type text not null, -- receive, issue, adjust, transfer, production
  quantity numeric(14,3) not null,
  unit_cost numeric(14,2) default 0,
  reference text,
  source_module text,
  source_id text,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

-- ─── SALES (shares customers) ────────────────────────────────────────────────
create table if not exists sales_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  order_no text,
  customer_id uuid references customers(id),
  customer_name text,
  sales_owner text, -- copied from customer at order time
  sales_rep text,
  order_date date not null default current_date,
  status text not null default 'Open',
  delivery_status text default 'Pending Delivery',
  subtotal numeric(14,2) default 0,
  tax numeric(14,2) default 0,
  total numeric(14,2) default 0,
  paid numeric(14,2) default 0,
  balance numeric(14,2) default 0,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sales_orders_customer on sales_orders(customer_id);
create index if not exists idx_sales_orders_owner on sales_orders(sales_owner);

create table if not exists sales_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references sales_orders(id) on delete cascade,
  product_id uuid references products(id),
  product_name text,
  quantity numeric(14,3) not null,
  unit_price numeric(14,2) not null,
  line_total numeric(14,2) not null
);

-- ─── CRM (same customers; activities & follow-ups) ───────────────────────────
create table if not exists crm_calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  customer_id uuid references customers(id),
  customer_name text,
  phone text,
  stage text default 'Logged',
  outcome text,
  notes text,
  comments text,
  follow_up_date date,
  assigned_to text,
  sales_owner text, -- denormalized from customer for filtering
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists crm_followups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  customer_id uuid references customers(id),
  follow_up_date date,
  stage text,
  next_step text,
  comments text,
  phone text,
  sales_owner text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists crm_leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  name text not null,
  company text,
  phone text,
  email text,
  stage text default 'Open',
  value numeric(14,2) default 0,
  assigned_to text,
  sales_owner text,
  created_at timestamptz not null default now()
);

create table if not exists crm_visits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  customer_id uuid references customers(id),
  salesperson text,
  visit_date date,
  notes text,
  outcome text,
  created_at timestamptz not null default now()
);

-- ─── DELIVERIES ──────────────────────────────────────────────────────────────
create table if not exists deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  delivery_no text,
  sale_id uuid references sales_orders(id),
  customer_id uuid references customers(id),
  customer_name text,
  destination text,
  delivery_method text,
  driver text,
  vehicle text,
  status text default 'Pending Delivery',
  arrival date,
  notes text,
  note_history jsonb default '[]'::jsonb,
  value numeric(14,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── ACCOUNTS / FINANCE ──────────────────────────────────────────────────────
create table if not exists finance_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  code text not null,
  name text not null,
  account_type text not null, -- Asset, Liability, Equity, Revenue, Expense
  balance numeric(14,2) default 0,
  status text default 'Active',
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  inv_no text,
  customer_id uuid references customers(id),
  customer_name text,
  sales_owner text,
  invoice_date date not null default current_date,
  due_date date,
  status text default 'Open',
  subtotal numeric(14,2) default 0,
  tax numeric(14,2) default 0,
  total numeric(14,2) default 0,
  paid numeric(14,2) default 0,
  balance numeric(14,2) default 0,
  shipping_address text,
  billing_address text,
  terms text,
  notes text,
  source_module text default 'accounts',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade,
  product_id uuid references products(id),
  description text,
  quantity numeric(14,3) not null,
  unit_price numeric(14,2) not null,
  line_total numeric(14,2) not null
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  invoice_id uuid references invoices(id),
  customer_id uuid references customers(id),
  amount numeric(14,2) not null,
  method text,
  reference text,
  paid_at date not null default current_date,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  journal_no text,
  entry_date date not null default current_date,
  description text,
  source_module text,
  source_id text,
  reference text,
  total_debit numeric(14,2) default 0,
  total_credit numeric(14,2) default 0,
  approval_status text default 'Posted',
  posted_by text,
  created_at timestamptz not null default now()
);

create table if not exists journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid references journal_entries(id) on delete cascade,
  account_id uuid references finance_accounts(id),
  account_code text,
  account_name text,
  debit numeric(14,2) default 0,
  credit numeric(14,2) default 0
);

create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  account_name text not null,
  bank text,
  account_number text,
  currency text default 'KES',
  opening_balance numeric(14,2) default 0,
  balance numeric(14,2) default 0,
  status text default 'Active'
);

-- ─── MANUFACTURING ───────────────────────────────────────────────────────────
create table if not exists product_formulas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  product_id uuid references products(id),
  version text default 'v1',
  status text default 'Active',
  created_at timestamptz not null default now()
);

create table if not exists formula_items (
  id uuid primary key default gen_random_uuid(),
  formula_id uuid references product_formulas(id) on delete cascade,
  material_product_id uuid references products(id),
  quantity numeric(14,3) not null,
  unit text
);

create table if not exists production_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  job_no text,
  product_id uuid references products(id),
  product_name text,
  planned_qty numeric(14,3),
  actual_qty numeric(14,3) default 0,
  status text default 'Planned',
  start_date date,
  end_date date,
  assigned_to text,
  created_at timestamptz not null default now()
);

create table if not exists production_material_requests (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references production_jobs(id),
  product_id uuid references products(id),
  quantity numeric(14,3) not null,
  status text default 'Requested',
  issued_qty numeric(14,3) default 0,
  created_at timestamptz not null default now()
);

-- ─── HR / LEAVES / PAYROLL ───────────────────────────────────────────────────
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  employee_no text,
  first_name text,
  middle_name text,
  last_name text,
  full_name text not null,
  gender text,
  date_of_birth date,
  nationality text default 'Kenyan',
  marital_status text,
  personal_email text,
  company_email text,
  phone text,
  alt_phone text,
  address text,
  county text,
  city text,
  postal_code text,
  national_id text,
  passport_no text,
  department text,
  position text,
  job_grade text,
  branch text,
  location text,
  manager_name text,
  employment_type text default 'Full-time',
  join_date date,
  contract_start date,
  contract_end date,
  probation_end date,
  status text default 'Active',
  pay_type text default 'Salary',
  basic_salary numeric(14,2) default 0,
  hourly_rate numeric(14,2) default 0,
  house_allowance numeric(14,2) default 0,
  transport_allowance numeric(14,2) default 0,
  medical_allowance numeric(14,2) default 0,
  other_allowances numeric(14,2) default 0,
  kra_pin text,
  nssf_number text,
  nhif_number text,
  payroll_number text,
  bank_name text,
  bank_branch text,
  bank_account text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  leave_balance_annual numeric(8,1) default 21,
  leave_balance_sick numeric(8,1) default 10,
  profile_photo_url text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  employee_id uuid references employees(id),
  work_date date not null,
  check_in text,
  check_out text,
  break_minutes int default 0,
  status text default 'Present',
  shift_type text,
  work_location text,
  geo_lat numeric,
  geo_lng numeric,
  device_info text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists leave_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  employee_id uuid references employees(id),
  leave_type text not null,
  start_date date not null,
  end_date date not null,
  days numeric(8,1) not null,
  reason text,
  status text default 'Pending',
  manager_status text,
  hr_status text,
  comments text,
  created_at timestamptz not null default now()
);

create table if not exists hr_notes (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  visibility text not null default 'public' check (visibility in ('public','private')),
  body text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists hr_timeline (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  action text,
  description text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  name text not null,
  email text,
  phone text,
  position text,
  department text,
  stage text default 'Applied',
  source text,
  expected_salary numeric(14,2) default 0,
  rating numeric(3,1) default 0,
  created_at timestamptz not null default now()
);

create table if not exists performance_reviews (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id),
  period text,
  rating numeric(3,1),
  goals text,
  feedback text,
  status text default 'Pending',
  reviewer text,
  created_at timestamptz not null default now()
);

-- ─── REQUISITIONS / NOTIFICATIONS / AUDIT ────────────────────────────────────
create table if not exists requisitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  req_no text,
  module text,
  requester text,
  status text default 'Pending',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  user_id uuid references profiles(id),
  category text,
  title text,
  body text,
  priority text default 'medium',
  status text default 'unread',
  source_module text,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  actor text,
  module text,
  action text,
  entity_type text,
  entity_id text,
  detail text,
  created_at timestamptz not null default now()
);

-- ─── ANALYTICS MATERIALIZED VIEWS (decision badge) ───────────────────────────
create materialized view if not exists analytics_revenue_summary as
select
  date_trunc('week', order_date)::date as week_start,
  coalesce(sum(total),0) as revenue,
  coalesce(sum(paid),0) as collected,
  count(*) as order_count
from sales_orders
group by 1;

create materialized view if not exists analytics_inventory_health as
select
  p.id as product_id,
  p.name,
  coalesce(sum(i.quantity),0) as on_hand,
  p.reorder_level,
  case when coalesce(sum(i.quantity),0) <= p.reorder_level then 'Low' else 'OK' end as health
from products p
left join inventory_items i on i.product_id = p.id
group by p.id, p.name, p.reorder_level;

create materialized view if not exists analytics_customer_value as
select
  c.id as customer_id,
  c.name,
  c.sales_owner,
  c.customer_type,
  coalesce(sum(s.total),0) as lifetime_value,
  count(s.id) as order_count
from customers c
left join sales_orders s on s.customer_id = c.id
group by c.id, c.name, c.sales_owner, c.customer_type;

create materialized view if not exists analytics_executive_summary as
select
  (select count(*) from customers where not is_deleted) as customers,
  (select count(*) from sales_orders) as orders,
  (select coalesce(sum(total),0) from sales_orders) as revenue,
  (select coalesce(sum(balance),0) from invoices) as ar_balance,
  (select count(*) from employees where status = 'Active' and not is_deleted) as active_employees;

-- ─── RLS (basic tenant isolation; tighten per role in production) ────────────
alter table customers enable row level security;
alter table sales_orders enable row level security;
alter table invoices enable row level security;
alter table employees enable row level security;
alter table erp_state enable row level security;

-- Service role bypasses RLS; anon policies can be added when using direct client access.

-- ─── HELPERS ─────────────────────────────────────────────────────────────────
comment on column customers.sales_owner is 'Permanent sales person tag; shared by Sales and CRM. Do not clear on CRM edits unless reassignOwner.';
comment on table customers is 'Single customer master for Sales + CRM';
comment on table erp_state is 'Optional JSON bridge for monolithic ERP state hydration';
