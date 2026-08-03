# Farmtrack Biosciences — Supabase Plan

## Goals
- Single source of truth for all modules
- Sales + CRM share `customers` with permanent `sales_owner`
- No static demo series in analytics
- Safe multi-user access (~100 concurrent)

## 1. Apply schema
Run in Supabase SQL editor:

`COMPLETE_SUPABASE_SCHEMA.sql`

Creates: tenants, profiles, erp_state, customers (sales_owner), suppliers, products, inventory, sales_orders, CRM tables, deliveries, finance, manufacturing, HR, notifications, audit, analytics materialized views.

## 2. Environment (Vercel)
```
VITE_SUPABASE_URL=https://qiwggxoaqeptdqzpwgft.supabase.co
VITE_SUPABASE_ANON_KEY=<anon>
SUPABASE_URL=https://qiwggxoaqeptdqzpwgft.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role>
SUPABASE_ANON_KEY=<anon>
```

## 3. Data flow
| Layer | Role |
|--------|------|
| `erp_state` | Fast JSON bridge for current monolithic UI |
| Relational tables | Normalized write path (customers, sales, inventory…) |
| RPCs in `api/rpc.js` | Business rules; dual-write when table exists |
| Materialized views | Executive Analytics badge |

## 4. Priority dual-write order
1. customers (+ sales_owner)
2. products / inventory_items / inventory_transactions
3. sales_orders + invoice + payments
4. crm_calls / crm_followups
5. employees / leave_applications / attendance
6. production_jobs + material requests

## 5. CRM / Sales sharing rule
- Insert/update customer once
- Stamp `sales_owner` on create (current user)
- CRM edits never clear `sales_owner` unless `reassignOwner=true`
- Sales orders copy `sales_owner` at order time

## 6. Ops
- Refresh analytics views hourly or after major posts
- RLS: enable per tenant; service role for server RPC only
- Backup: point-in-time recovery on Pro plan
