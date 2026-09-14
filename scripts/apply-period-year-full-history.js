/**
 * Force Year/All history visibility system-wide.
 * Root cause: period default Month hid June QBO sales/CRM when today is September.
 */
const fs = require('fs');
const path = require('path');

const RPC = path.join(__dirname, '..', 'api', 'rpc.js');
let src = fs.readFileSync(RPC, 'utf8');
const before = src.length;

const prRe = /function periodRange\(period = ['"]Month['"]\)\s*\{[\s\S]*?return \{ startDate:[\s\S]*?\};\s*\}/;
const prNew = `function periodRange(period = 'Year') {
  const cleanPeriod = String(period || 'Year').toLowerCase();
  let days = 365;
  if (cleanPeriod.includes('all') || cleanPeriod.includes('history') || cleanPeriod.includes('full') || cleanPeriod.includes('lifetime')) days = 2000;
  else if (cleanPeriod.includes('day') && !cleanPeriod.includes('today')) days = 1;
  else if (cleanPeriod.includes('week')) days = 7;
  else if (cleanPeriod.includes('month')) days = 30;
  else if (cleanPeriod.includes('quarter')) days = 90;
  else if (cleanPeriod.includes('year')) days = 365;
  else days = 365;
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));
  const label = days === 1 ? 'Day' : days === 7 ? 'Week' : days === 30 ? 'Month' : days === 90 ? 'Quarter' : days >= 2000 ? 'All' : 'Year';
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), days, label };
}`;

if (prRe.test(src)) {
  src = src.replace(prRe, prNew);
  console.log('[period] periodRange -> Year default + All');
} else if (src.includes("function periodRange(period = 'Year')")) {
  console.log('[period] already Year default');
} else {
  console.warn('[period] periodRange pattern not found');
}

src = src.split("filters.period || 'Month'").join("filters.period || 'Year'");
src = src.split("period || 'Month'").join("period || 'Year'");

const salesOld = `const salesAll = (list('sales') || []).filter(row => inDateRange(row, scope));\n    const sales = filterSalesScoped(user, salesAll);\n    const invoices = filterSalesScoped(user, (list('invoices') || []).filter(row => inDateRange(row, scope)));`;
const salesNew = `let salesAll = (list('sales') || []).filter(row => inDateRange(row, scope));\n    if (!salesAll.length) salesAll = list('sales') || [];\n    const sales = filterSalesScoped(user, salesAll);\n    let invoices = filterSalesScoped(user, (list('invoices') || []).filter(row => inDateRange(row, scope)));\n    if (!invoices.length) invoices = filterSalesScoped(user, list('invoices') || []);`;
if (src.includes(salesOld)) {
  src = src.replace(salesOld, salesNew);
  console.log('[period] sales Month-empty -> full history fallback');
}

if (!src.includes("getCRMWorkspaceData(user, filters = {}) {\n    reqRole(user);\n    if (!filters || !filters.period)")) {
  src = src.replace(
    'getCRMWorkspaceData(user, filters = {}) {\n    reqRole(user);',
    "getCRMWorkspaceData(user, filters = {}) {\n    reqRole(user);\n    if (!filters || !filters.period) filters = { ...(filters || {}), period: 'Year' };"
  );
  console.log('[period] CRM default Year');
}

if (src.length !== before) {
  fs.writeFileSync(RPC, src);
  console.log('[period] wrote api/rpc.js delta', src.length - before);
} else {
  console.log('[period] no file change');
}
