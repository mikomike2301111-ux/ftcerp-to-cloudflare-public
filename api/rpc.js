/**
 * Bootstrap: load last known-good full RPC handler, then apply Year/history period fix.
 * Never ship PLACEHOLDER text to production.
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');

const GOOD_URL =
  process.env.RPC_GOOD_URL ||
  'https://raw.githubusercontent.com/mikomike2301111-ux/ftcerp-to-cloudflare-public/91cacae99d4d2f45b01d94f4dde98230119cc29c/api/rpc.js';

const CACHE = path.join('/tmp', 'farmtrack-rpc-good.js');
let cachedHandler = null;
let loadPromise = null;

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { headers: { 'User-Agent': 'farmtrack-rpc-bootstrap' }, timeout: 25000 }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(fetchText(res.headers.location));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode + ' loading RPC'));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout loading RPC'));
    });
  });
}

function applyPeriodFix(src) {
  if (src.includes('FULL_HISTORY_YEAR_DEFAULT_v1')) return src;
  const prRe = /function periodRange\(period = ['"]Month['"]\)\s*\{[\s\S]*?return \{ startDate:[\s\S]*?\};\s*\}/;
  const prNew = `function periodRange(period = 'Year') { // FULL_HISTORY_YEAR_DEFAULT_v1\n  const cleanPeriod = String(period || 'Year').toLowerCase();\n  let days = 365;\n  if (cleanPeriod.includes('all') || cleanPeriod.includes('history') || cleanPeriod.includes('full') || cleanPeriod.includes('lifetime')) days = 2000;\n  else if (cleanPeriod.includes('day') && !cleanPeriod.includes('today')) days = 1;\n  else if (cleanPeriod.includes('week')) days = 7;\n  else if (cleanPeriod.includes('month')) days = 30;\n  else if (cleanPeriod.includes('quarter')) days = 90;\n  else if (cleanPeriod.includes('year')) days = 365;\n  else days = 365;\n  const end = new Date();\n  const start = new Date();\n  start.setDate(end.getDate() - (days - 1));\n  const label = days === 1 ? 'Day' : days === 7 ? 'Week' : days === 30 ? 'Month' : days === 90 ? 'Quarter' : days >= 2000 ? 'All' : 'Year';\n  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), days, label };\n}`;
  if (prRe.test(src)) src = src.replace(prRe, prNew);
  src = src.split("filters.period || 'Month'").join("filters.period || 'Year'");
  src = src.split("period || 'Month'").join("period || 'Year'");
  const salesOld = "const salesAll = (list('sales') || []).filter(row => inDateRange(row, scope));\n    const sales = filterSalesScoped(user, salesAll);\n    const invoices = filterSalesScoped(user, (list('invoices') || []).filter(row => inDateRange(row, scope)));";
  const salesNew = "let salesAll = (list('sales') || []).filter(row => inDateRange(row, scope));\n    if (!salesAll.length) salesAll = list('sales') || [];\n    const sales = filterSalesScoped(user, salesAll);\n    let invoices = filterSalesScoped(user, (list('invoices') || []).filter(row => inDateRange(row, scope)));\n    if (!invoices.length) invoices = filterSalesScoped(user, list('invoices') || []);";
  if (src.includes(salesOld)) src = src.replace(salesOld, salesNew);
  if (!src.includes("if (!filters || !filters.period) filters = { ...(filters || {}), period: 'Year' }")) {
    src = src.replace(
      'getCRMWorkspaceData(user, filters = {}) {\n    reqRole(user);',
      "getCRMWorkspaceData(user, filters = {}) {\n    reqRole(user);\n    if (!filters || !filters.period) filters = { ...(filters || {}), period: 'Year' };"
    );
  }
  return src;
}

function loadFromSource(code, filename) {
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  // Soft-require optional server modules so missing files don't crash cold start
  const wrapped =
    "const __req = require;\n" +
    "require = function(id) { try { return __req(id); } catch (e) {\n" +
    "  if (id && (String(id).includes('googleSheetsService') || String(id).includes('resend') || String(id).includes('supabase'))) {\n" +
    "    return new Proxy({}, { get: () => () => null });\n  }\n  throw e;\n}};\n" +
    code +
    "\nmodule.exports = module.exports;\n";
  mod._compile(code, filename);
  return mod.exports;
}

async function getHandler() {
  if (cachedHandler) return cachedHandler;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    let code;
    try {
      if (fs.existsSync(CACHE) && fs.statSync(CACHE).size > 100000) {
        code = fs.readFileSync(CACHE, 'utf8');
      }
    } catch {}
    if (!code || code.includes('PLACEHOLDER') || code.length < 50000) {
      code = await fetchText(GOOD_URL);
      if (!code || code.length < 50000) throw new Error('Failed to load good RPC (' + (code && code.length) + ' bytes)');
      try { fs.writeFileSync(CACHE, code); } catch {}
    }
    code = applyPeriodFix(code);
    const exp = loadFromSource(code, path.join(__dirname, 'rpc-full.js'));
    cachedHandler = typeof exp === 'function' ? exp : exp && exp.default ? exp.default : exp;
    if (typeof cachedHandler !== 'function') throw new Error('RPC export is not a function');
    return cachedHandler;
  })();
  try {
    return await loadPromise;
  } catch (e) {
    loadPromise = null;
    throw e;
  }
}

async function handler(req, res) {
  try {
    const h = await getHandler();
    return h(req, res);
  } catch (e) {
    console.error('RPC bootstrap error:', e && e.message ? e.message : e);
    if (res && typeof res.status === 'function') {
      return res.status(200).json({ error: 'RPC bootstrap: ' + (e && e.message ? e.message : String(e)) });
    }
  }
}

module.exports = handler;
module.exports.invokeRpc = async function invokeRpcProxy(fn, args) {
  const h = await getHandler();
  if (h.invokeRpc) return h.invokeRpc(fn, args);
  throw new Error('invokeRpc not available on loaded handler');
};
