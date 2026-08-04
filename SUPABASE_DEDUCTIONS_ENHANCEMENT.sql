-- Farmtrack ERP — Fully editable HR deductions (names, amounts, percentages)
-- Project: https://supabase.com/dashboard/project/rajnrkgcisgpxtzzfmcl

create table if not exists public.employee_deductions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  employee_id uuid references public.employees(id) on delete cascade,
  label text not null,
  method text default 'Fixed',
  amount numeric not null default 0,
  percent numeric default 0,
  deduction_type text default 'Recurring',
  tax_exempt boolean default false,
  active boolean default true,
  notes text,
  effective_from date,
  effective_to date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.employee_deductions
  add column if not exists method text default 'Fixed',
  add column if not exists percent numeric default 0,
  add column if not exists tax_exempt boolean default false,
  add column if not exists active boolean default true,
  add column if not exists notes text,
  add column if not exists effective_from date,
  add column if not exists effective_to date,
  add column if not exists updated_at timestamptz default now();

-- Optional: company-wide deduction templates HR can reuse
create table if not exists public.deduction_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  label text not null,
  method text default 'Fixed',
  default_amount numeric default 0,
  default_percent numeric default 0,
  deduction_type text default 'Recurring',
  tax_exempt boolean default false,
  active boolean default true,
  created_at timestamptz default now()
);

create index if not exists employee_deductions_emp_idx on public.employee_deductions (employee_id);
create index if not exists employee_deductions_active_idx on public.employee_deductions (active);

grant all on public.employee_deductions to service_role;
grant all on public.deduction_templates to service_role;
grant select on public.employee_deductions to authenticated;
grant select on public.deduction_templates to authenticated;
