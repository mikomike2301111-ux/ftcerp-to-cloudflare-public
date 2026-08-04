-- Farmtrack ERP — Payroll / HR additions (SHIF, custom deductions, payslips)
-- Project: https://supabase.com/dashboard/project/rajnrkgcisgpxtzzfmcl
-- Safe to re-run

-- Employee payroll flags / identifiers
alter table if exists public.employees
  add column if not exists apply_shif boolean default false,
  add column if not exists shif_number text,
  add column if not exists kra_pin text,
  add column if not exists pay_type text default 'Salary',
  add column if not exists hourly_rate numeric default 0,
  add column if not exists basic_salary numeric default 0,
  add column if not exists house_allowance numeric default 0,
  add column if not exists transport_allowance numeric default 0,
  add column if not exists medical_allowance numeric default 0,
  add column if not exists communication_allowance numeric default 0,
  add column if not exists loan_deduction numeric default 0,
  add column if not exists sacco_deduction numeric default 0,
  add column if not exists other_deductions numeric default 0,
  add column if not exists company_email text,
  add column if not exists personal_email text;

-- Unlimited HR custom deductions per employee
create table if not exists public.employee_deductions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  employee_id uuid references public.employees(id) on delete cascade,
  label text not null,
  amount numeric not null default 0,
  deduction_type text default 'Recurring', -- Recurring | One-time | Tax | SHIF | Loan | Other
  tax_exempt boolean default false,
  active boolean default true,
  effective_from date,
  effective_to date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists employee_deductions_emp_idx on public.employee_deductions (employee_id);

-- Payroll run header (monthly / weekly)
create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  period_label text,
  start_date date not null,
  end_date date not null,
  status text default 'Draft', -- Draft | Reviewed | Posted | Paid
  total_gross numeric default 0,
  total_paye numeric default 0,
  total_shif numeric default 0,
  total_deductions numeric default 0,
  total_net numeric default 0,
  posted_by text,
  posted_at timestamptz,
  created_at timestamptz default now()
);

-- Payroll lines (one row per employee per run)
create table if not exists public.payroll_lines (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid references public.payroll_runs(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  employee_no text,
  employee_name text,
  department text,
  hours_worked numeric default 0,
  expected_hours numeric default 0,
  overtime_hours numeric default 0,
  late_hours numeric default 0,
  base_pay numeric default 0,
  allowances numeric default 0,
  overtime_pay numeric default 0,
  gross_pay numeric default 0,
  paye numeric default 0,
  shif numeric default 0,
  custom_deductions numeric default 0,
  late_deduction numeric default 0,
  total_deductions numeric default 0,
  net_pay numeric default 0,
  pay_type text,
  notes text,
  created_at timestamptz default now()
);
create index if not exists payroll_lines_run_idx on public.payroll_lines (payroll_run_id);
create index if not exists payroll_lines_emp_idx on public.payroll_lines (employee_id);

-- Payslip email log
create table if not exists public.payslip_emails (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete set null,
  payroll_line_id uuid references public.payroll_lines(id) on delete set null,
  to_email text not null,
  subject text,
  status text default 'sent',
  sent_by text,
  sent_at timestamptz default now(),
  error text
);

-- Attendance already exists in many installs; ensure columns for Mon–Sat schedule
alter table if exists public.attendance
  add column if not exists hours_worked numeric default 0,
  add column if not exists check_in text,
  add column if not exists check_out text,
  add column if not exists shift_type text,
  add column if not exists work_location text,
  add column if not exists break_minutes int default 0;

-- Helpful views
create or replace view public.analytics_payroll_summary as
select
  pr.period_label,
  pr.start_date,
  pr.end_date,
  pr.status,
  count(pl.id)::int as employee_count,
  coalesce(sum(pl.gross_pay), 0) as total_gross,
  coalesce(sum(pl.paye), 0) as total_paye,
  coalesce(sum(pl.shif), 0) as total_shif,
  coalesce(sum(pl.net_pay), 0) as total_net
from public.payroll_runs pr
left join public.payroll_lines pl on pl.payroll_run_id = pr.id
group by pr.id, pr.period_label, pr.start_date, pr.end_date, pr.status;

grant select on public.analytics_payroll_summary to anon, authenticated, service_role;
grant all on public.employee_deductions to service_role;
grant all on public.payroll_runs to service_role;
grant all on public.payroll_lines to service_role;
grant all on public.payslip_emails to service_role;
