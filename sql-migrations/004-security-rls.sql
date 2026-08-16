-- ============================================================
-- Migration 004: SECURITY — lock down erp_state + missing grants
-- Run on Supabase SQL Editor (project rajnrkgcisgpxtzzfmcl).
-- Fixes the critical finding: anon/publishable key could READ/WRITE
-- the entire ERP state row. After this, only the service role can
-- access erp_state. The browser never talks to Supabase directly
-- (everything goes through /api/rpc using the service role), so
-- this is safe for the deployed app.
-- ============================================================

-- 1) Enable RLS on the ERP state table (should already be on; idempotent)
alter table if exists public.erp_state enable row level security;

-- 2) Drop ANY existing policies (incl. any permissive anon/authenticated ones)
drop policy if exists "Service role can manage ERP state" on public.erp_state;
drop policy if exists "service role all" on public.erp_state;
drop policy if exists "anon read" on public.erp_state;
drop policy if exists "anon all" on public.erp_state;
drop policy if exists "authenticated read" on public.erp_state;
drop policy if exists "authenticated all" on public.erp_state;
drop policy if exists "erp_state anon select" on public.erp_state;
drop policy if exists "erp_state anon all" on public.erp_state;

-- 3) Service-role only access (the app's server path)
create policy "erp_state service role all"
  on public.erp_state
  for all
  to service_role
  using (true)
  with check (true);

-- 4) Belt and suspenders: revoke all from anon/authenticated at the grant level
revoke all on public.erp_state from anon;
revoke all on public.erp_state from authenticated;
revoke all on public.erp_state from public;

-- 5) (Optional, recommended) A dedicated owner role if you adopt Supabase Auth later.
-- Not created here to avoid breaking the current server-session model.

-- 6) Verify what remains accessible:
select schemaname, tablename, policyname, roles
from pg_policies
where schemaname = 'public' and tablename = 'erp_state';