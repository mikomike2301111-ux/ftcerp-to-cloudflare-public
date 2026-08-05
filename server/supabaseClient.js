/**
 * Farmtrack ERP — Supabase server client
 * Project: https://supabase.com/dashboard/project/rajnrkgcisgpxtzzfmcl
 *
 * Env (Vercel + local):
 *   SUPABASE_URL
 *   SUPABASE_PUBLISHABLE_KEY
 *   SUPABASE_SECRET_KEY
 *   SUPABASE_JWKS_URL
 *
 * Packages: @supabase/supabase-js + @supabase/server
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = String(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rajnrkgcisgpxtzzfmcl.supabase.co'
).trim().replace(/\/$/, '');

const SUPABASE_SECRET = String(
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  ''
).trim();

const SUPABASE_PUBLISHABLE = String(
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ''
).trim();

const SUPABASE_JWKS_URL = String(
  process.env.SUPABASE_JWKS_URL ||
  `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`
).trim();

function getServiceClient() {
  if (!SUPABASE_URL || !SUPABASE_SECRET) {
    throw new Error('Supabase service credentials missing (SUPABASE_URL / SUPABASE_SECRET_KEY)');
  }
  return createClient(SUPABASE_URL, SUPABASE_SECRET, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function getAnonClient() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE) {
    throw new Error('Supabase publishable credentials missing (SUPABASE_PUBLISHABLE_KEY)');
  }
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

/** Health probe used by Settings / ops */
async function probeSupabase() {
  const started = Date.now();
  try {
    if (!SUPABASE_URL || !SUPABASE_SECRET) {
      return { ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SECRET_KEY', ms: 0 };
    }
    const client = getServiceClient();
    const { data, error } = await client.from('erp_state').select('id,updated_at').eq('id', 'farmtrack-demo').limit(1);
    if (error) return { ok: false, error: error.message, ms: Date.now() - started };
    return {
      ok: true,
      ms: Date.now() - started,
      url: SUPABASE_URL,
      jwks: SUPABASE_JWKS_URL,
      row: data && data[0] ? data[0] : null,
      publishableConfigured: Boolean(SUPABASE_PUBLISHABLE)
    };
  } catch (e) {
    return { ok: false, error: e.message || String(e), ms: Date.now() - started };
  }
}

module.exports = {
  SUPABASE_URL,
  SUPABASE_SECRET,
  SUPABASE_PUBLISHABLE,
  SUPABASE_JWKS_URL,
  getServiceClient,
  getAnonClient,
  probeSupabase,
  supabaseEnabled: () => Boolean(SUPABASE_URL && (SUPABASE_SECRET || SUPABASE_PUBLISHABLE))
};
