/**
 * Bootstrap: load last good RPC + Year period + D1 CRM snapshot merge + deliveries from sales.
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
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
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout loading RPC')); });
  });
}

function applyFixes(src) {
  if (src.includes('FULL_HISTORY_YEAR_DEFAULT_v2')) return src;

  const prRe = /function periodRange\(period = ['"]Month['"]\)\s*\{[\s\S]*?return \{ startDate:[\s\S]*?\};\s*\}/;
  const prNew = `function periodRange(period = 'Year') { // FULL_HISTORY_YEAR_DEFAULT_v2\n  const cleanPeriod = String(period || 'Year').toLowerCase();\n  let days = 365;\n  if (cleanPeriod.includes('all') || cleanPeriod.includes('history') || cleanPeriod.includes('full') || cleanPeriod.includes('lifetime')) days = 2000;\n  else if (cleanPeriod.includes('day') && !cleanPeriod.includes('today')) days = 1;\n  else if (cleanPeriod.includes('week')) days = 7;\n  else if (cleanPeriod.includes('month')) days = 30;\n  else if (cleanPeriod.includes('quarter')) days = 90;\n  else if (cleanPeriod.includes('year')) days = 365;\n  else days = 365;\n  const end = new Date();\n  const start = new Date();\n  start.setDate(end.getDate() - (days - 1));\n  const label = days === 1 ? 'Day' : days === 7 ? 'Week' : days === 30 ? 'Month' : days === 90 ? 'Quarter' : days >= 2000 ? 'All' : 'Year';\n  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), days, label };\n}`;
  if (prRe.test(src)) src = src.replace(prRe, prNew);
  src = src.split("filters.period || 'Month'").join("filters.period || 'Year'");
  src = src.split("period || 'Month'").join("period || 'Year'");

  const salesOld = "const salesAll = (list('sales') || []).filter(row => inDateRange(row, scope));\n    const sales = filterSalesScoped(user, salesAll);\n    const invoices = filterSalesScoped(user, (list('invoices') || []).filter(row => inDateRange(row, scope)));";
  const salesNew = "let salesAll = (list('sales') || []).filter(row => inDateRange(row, scope));\n    if (!salesAll.length) salesAll = list('sales') || [];\n    const sales = filterSalesScoped(user, salesAll);\n    let invoices = filterSalesScoped(user, (list('invoices') || []).filter(row => inDateRange(row, scope)));\n    if (!invoices.length) invoices = filterSalesScoped(user, list('invoices') || []);";
  if (src.includes(salesOld)) src = src.replace(salesOld, salesNew);

  if (!src.includes('function mergeD1CrmSnapshot')) {
    const helpers = `\nfunction mergeD1CrmSnapshot(d) {\n  if (!d || d._d1CrmMerged) return;\n  let snap = null;\n  try { snap = require('../data/d1-crm-snapshot.json'); } catch (e) {\n    try { snap = require('../../data/d1-crm-snapshot.json'); } catch (e2) {}\n  }\n  if (!snap || !Array.isArray(snap.customers) || !snap.customers.length) {\n    snap = { customers: [], calls: [] };\n    for (const part of ['d1-cust-part0.json','d1-cust-part1.json','d1-cust-part2.json']) {\n      try {\n        const p = require('../data/' + part);\n        if (p && Array.isArray(p.customers)) snap.customers.push(...p.customers);\n      } catch (e3) {}\n    }\n  }\n  if (!snap || !Array.isArray(snap.customers)) { d._d1CrmMerged = true; return; }\n  d.customers = Array.isArray(d.customers) ? d.customers : [];\n  const byId = new Map(d.customers.map(c => [String(c.id), c]));\n  const byName = new Map(d.customers.map(c => [String(c.name || '').toLowerCase().trim(), c]));\n  let added = 0;\n  for (const c of snap.customers) {\n    if (!c || !c.id) continue;\n    if (byId.has(String(c.id))) continue;\n    const nm = String(c.name || '').toLowerCase().trim();\n    if (nm && byName.has(nm)) continue;\n    d.customers.push(c);\n    byId.set(String(c.id), c);\n    if (nm) byName.set(nm, c);\n    added++;\n  }\n  d.calls = Array.isArray(d.calls) ? d.calls : [];\n  const realCalls = d.calls.filter(c => c && !String(c.id || '').startsWith('QBCALL'));\n  if (realCalls.length) d.calls = realCalls;\n  d._d1CrmMerged = true;\n  d._d1CrmMeta = { addedCustomers: added, totalCustomers: d.customers.length, realCalls: d.calls.length };\n}\n\nfunction ensureDeliveriesFromSales(d) {\n  if (!d || d._deliveriesEnsured) return;\n  d.deliveries = Array.isArray(d.deliveries) ? d.deliveries : [];\n  d.sales = Array.isArray(d.sales) ? d.sales : [];\n  d.invoices = Array.isArray(d.invoices) ? d.invoices : [];\n  const have = new Set(d.deliveries.map(x => String(x.saleId || x.saleNo || x.id)));\n  const source = d.sales.length ? d.sales : d.invoices;\n  for (const s of source) {\n    const key = String(s.id || s.saleNo || s.invoiceNo || '');\n    if (!key || have.has(key)) continue;\n    d.deliveries.push({\n      id: 'DEL-' + key,\n      deliveryNo: 'DN-' + (s.saleNo || s.invoiceNo || key),\n      saleId: s.id,\n      saleNo: s.saleNo || s.invoiceNo || '',\n      customerId: s.customerId || '',\n      customerName: s.customerName || '',\n      status: (String(s.status || '').toLowerCase() === 'paid' || String(s.status || '').toLowerCase() === 'delivered') ? 'Delivered' : 'Pending',\n      destination: s.destination || s.shipTo || s.city || s.customerName || '',\n      date: s.date || s.createdAt || '',\n      createdAt: s.createdAt || s.date || new Date().toISOString(),\n      items: s.items || [],\n      productCount: s.productCount || (s.items && s.items.length) || 0,\n      source: 'auto-from-sales'\n    });\n    have.add(key);\n  }\n  const seen = new Set();\n  d.deliveries = d.deliveries.filter(row => {\n    const k = String(row.saleNo || row.saleId || row.id);\n    if (seen.has(k)) return false;\n    seen.add(k);\n    return true;\n  });\n  d._deliveriesEnsured = true;\n}\n\n`;
    const idx = src.indexOf('function data()');
    if (idx > 0) src = src.slice(0, idx) + helpers + src.slice(idx);
  }

  const dataNeedle = 'function data() {\n  if (!db) seed();\n  applyQuickBooksSeed();';
  const dataInject = `function data() {\n  if (!db) seed();\n  applyQuickBooksSeed();\n  try { mergeD1CrmSnapshot(db); } catch (e) { console.warn('mergeD1CrmSnapshot', e && e.message); }\n  try { ensureDeliveriesFromSales(db); } catch (e) { console.warn('ensureDeliveriesFromSales', e && e.message); }`;
  if (src.includes(dataNeedle) && !src.includes('mergeD1CrmSnapshot(db)')) {
    src = src.replace(dataNeedle, dataInject);
  }

  return src;
}

function loadFromSource(code, filename) {
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
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
    code = applyFixes(code);
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
