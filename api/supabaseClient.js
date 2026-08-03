/**
 * Farmtrack ERP — Supabase server client
 * Project: https://supabase.com/dashboard/project/rajnrkgcisgpxtzzfmcl
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
    throw new Error('Supabase publishable credentials missing');
  }
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

module.exports = {
  SUPABASE_URL,
  SUPABASE_SECRET,
  SUPABASE_PUBLISHABLE,
  SUPABASE_JWKS_URL,
  getServiceClient,
  getAnonClient,
  supabaseEnabled: () => Boolean(SUPABASE_URL && (SUPABASE_SECRET || SUPABASE_PUBLISHABLE))
};
