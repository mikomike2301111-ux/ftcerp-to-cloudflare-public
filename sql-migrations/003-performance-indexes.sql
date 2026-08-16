-- ============================================================
-- Migration 003: Performance indexes for Unity ERP
-- Run on Supabase SQL Editor. Only adds indexes that materially
-- help common queries (filters, sorting, joins, lookups) on the
-- normalized tables. Safe to re-run (IF NOT EXISTS).
-- ============================================================

-- Customers
create index if not exists idx_customers_tenant_status
  on public.customers (tenant_id, status);
create index if not exists idx_customers_name_ci
  on public.customers (tenant_id, lower(name));

-- Suppliers
create index if not exists idx_suppliers_tenant_status
  on public.suppliers (tenant_id, status);
create index if not exists idx_suppliers_name_ci
  on public.suppliers (tenant_id, lower(name));

-- Products
create index if not exists idx_products_tenant_category
  on public.products (tenant_id, category);
create index if not exists idx_products_sku
  on public.products (tenant_id, sku);

-- Invoices (filters commonly: status, due_date, customer, payment)
create index if not exists idx_invoices_tenant_status
  on public.invoices (tenant_id, status);
create index if not exists idx_invoices_tenant_due
  on public.invoices (tenant_id, due_date);
create index if not exists idx_invoices_customer_status
  on public.invoices (customer_id, status, balance);
create index if not exists idx_invoices_invoice_no
  on public.invoices (tenant_id, invoice_no);

-- Payments
create index if not exists idx_payments_tenant_date
  on public.payments (tenant_id, payment_date desc);
create index if not exists idx_payments_invoice
  on public.payments (invoice_id);
create index if not exists idx_payments_customer
  on public.payments (customer_id, payment_date desc);
create index if not exists idx_payments_method
  on public.payments (tenant_id, method, payment_date);

-- Payments (PK/account tracking)
create index if not exists idx_payment_accounts_tenant
  on public.payment_accounts (tenant_id, account_name);

-- Purchase orders
create index if not exists idx_purchase_orders_tenant_status
  on public.purchase_orders (tenant_id, status);
create index if not exists idx_purchase_orders_supplier
  on public.purchase_orders (supplier_id, created_at desc);
create index if not exists idx_purchase_orders_po_no
  on public.purchase_orders (tenant_id, po_no);

-- Purchase requests / requisitions
create index if not exists idx_purchase_requests_tenant_status
  on public.purchase_requests (tenant_id, approval_status);
create index if not exists idx_purchase_requests_dept
  on public.purchase_requests (department, created_at desc);

-- Supplier invoices / bills
create index if not exists idx_supplier_invoices_tenant_status
  on public.supplier_invoices (tenant_id, status);
create index if not exists idx_supplier_invoices_due
  on public.supplier_invoices (supplier_id, due_date);
create index if not exists idx_supplier_invoices_no
  on public.supplier_invoices (tenant_id, invoice_no);

-- Accounts payable
create index if not exists idx_accounts_payable_tenant_status
  on public.accounts_payable (tenant_id, payment_status);
create index if not exists idx_accounts_payable_supplier
  on public.accounts_payable (supplier_id, due_date);

-- Employees
create index if not exists idx_employees_tenant_status
  on public.employees (tenant_id, status);
create index if not exists idx_employees_dept
  on public.employees (department_id);

-- Attendance
create index if not exists idx_attendance_employee_date
  on public.attendance (employee_id, date desc);

-- Leave applications
create index if not exists idx_leave_apps_tenant_status
  on public.leave_applications (tenant_id, status);
create index if not exists idx_leave_apps_employee
  on public.leave_applications (employee_id, start_date);

-- Inventory items / inventory transactions / movements
create index if not exists idx_inventory_items_tenant_product
  on public.inventory_items (tenant_id, product_id, quantity);
create index if not exists idx_inventory_transactions_product_date
  on public.inventory_transactions (product_id, created_at desc);
create index if not exists idx_inventory_transactions_txn_type
  on public.inventory_transactions (tenant_id, transaction_type, created_at desc);
create index if not exists idx_inventory_movements_product
  on public.inventory_movements (product_id, created_at desc);

-- Chart of accounts + journals
create index if not exists idx_journal_entries_tenant_date
  on public.journal_entries (tenant_id, journal_date desc);
create index if not exists idx_journal_entries_status
  on public.journal_entries (tenant_id, approval_status);
create index if not exists idx_journal_lines_entry
  on public.journal_lines (journal_entry_id);
create index if not exists idx_journal_lines_account
  on public.journal_lines (account_id, debit, credit);
create index if not exists idx_general_ledger_account
  on public.general_ledger (account_id, posted_at desc);

-- Quotations / credit notes / returns
create index if not exists idx_quotations_tenant_status
  on public.quotations (tenant_id, status, created_at desc);
create index if not exists idx_credit_notes_tenant_status
  on public.credit_notes (tenant_id, status);
create index if not exists idx_credit_notes_invoice
  on public.credit_notes (invoice_id);
create index if not exists idx_product_returns_invoice
  on public.product_returns (invoice_id, created_at desc);

-- Notifications + audit
create index if not exists idx_notifications_tenant_read
  on public.notifications (tenant_id, read, created_at desc);
create index if not exists idx_audit_logs_tenant_created
  on public.audit_logs (tenant_id, created_at desc);
create index if not exists idx_audit_logs_user
  on public.audit_logs (user_id, created_at desc);

-- Realtime-friendly: append-only business events
create index if not exists idx_business_events_tenant_type
  on public.business_events (tenant_id, event_type, created_at desc);