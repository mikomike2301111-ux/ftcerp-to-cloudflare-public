# Farmtrack ERP — Supabase setup

**Project:** https://supabase.com/dashboard/project/rajnrkgcisgpxtzzfmcl  
**URL:** https://rajnrkgcisgpxtzzfmcl.supabase.co

## 1. Run schema
SQL Editor → paste `COMPLETE_SUPABASE_SCHEMA.sql` → Run

## 2. Environment (Vercel + local)
```
SUPABASE_URL=https://rajnrkgcisgpxtzzfmcl.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_SERVICE_ROLE_KEY=<same as secret>
SUPABASE_JWKS_URL=https://rajnrkgcisgpxtzzfmcl.supabase.co/auth/v1/.well-known/jwks.json
```

## 3. Packages
```
npm install @supabase/supabase-js @supabase/server
```

## 4. App wiring
- `api/rpc.js` — primary ERP state + normalized sync via REST
- `api/supabaseClient.js` — createClient helpers (service + anon)
- `erp_state` id: `farmtrack-demo` (empty JSON until first save)

No demo transactional data is seeded.
