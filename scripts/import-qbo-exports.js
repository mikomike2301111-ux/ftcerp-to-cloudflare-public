const fs = require('fs');
const path = require('path');

const DOWNLOADS = process.env.QBO_EXPORT_DIR || 'C:\\Users\\user\\Downloads';
const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rajnrkgcisgpxtzzfmcl.supabase.co').replace(/\/$/, '');
const SUPABASE_KEY = [
  process.env.SUPABASE_SECRET_KEY,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.SUPABASE_SERVICE_KEY,
  process.env.SUPABASE_PUBLISHABLE_KEY,
  process.env.SUPABASE_ANON_KEY,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
].map(v => String(v || '').trim()).filter(Boolean).find(k => k.startsWith('sb_secret_'))
  || [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SECRET_KEY, process.env.SUPABASE_SERVICE_KEY, process.env.SUPABASE_ANON_KEY, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY].map(v => String(v || '').trim()).find(Boolean);
const STATE_ID = 'farmtrack-demo';

const files = {
  customers: 'Customers.csv',
  arDetail: 'Farmtrack Biosciences Ltd_A_R Ageing Detail Report.csv',
  customerBalance: 'Farmtrack Biosciences Ltd_Customer Balance Detail Report(Beta).csv',
  invoicesPayments: 'Farmtrack Biosciences Ltd_Invoices and Received Payments.csv',
  apAgeing: 'Farmtrack Biosciences Ltd_A_P Ageing Summary Report.csv',
  inventory: 'Farmtrack Biosciences Ltd_Inventory Status.csv',
  openPo: 'Farmtrack Biosciences Ltd_Open Purchase Order List by Supplier.csv',
  purchasesRecent: 'Farmtrack Biosciences Ltd_Purchases by Location Detail.csv',
  purchasesAll: 'Farmtrack Biosciences Ltd_Purchases by Location Detail (1).csv',
  salesA: 'Farmtrack Biosciences Ltd_Sales by Customer Type Detail.csv',
  salesB: 'Farmtrack Biosciences Ltd_Sales by Customer Type Detail (1).csv',
  tax: 'TEMP_CSV.prod.QBOC4_UW2APP21.20260810.043547.16114684636272450944432176471601621390.csv',
  balanceSummary: 'Farmtrack Biosciences Ltd_Balance Sheet Summary.csv',
  balanceDetail: 'Farmtrack Biosciences Ltd_Balance Sheet (1).csv',
  journal: 'Farmtrack Biosciences Ltd_Journal.csv'
};

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  text = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(cell); cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(v => String(v || '').trim()));
}

function readCsv(name) {
  const p = path.join(DOWNLOADS, name);
  if (!fs.existsSync(p)) return [];
  return parseCsv(fs.readFileSync(p, 'utf8'));
}

function amount(v) {
  const s = String(v || '').replace(/Ksh|KES|\s/g, '').replace(/,/g, '');
  if (/^-Ksh/i.test(String(v || ''))) return -Number(s.replace('-', '')) || 0;
  return Number(s) || 0;
}

function dateIso(v) {
  const s = String(v || '').trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s.slice(0, 10) || new Date().toISOString().slice(0, 10);
}

function slug(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'unknown';
}

function id(prefix, parts) {
  return `${prefix}-${slug(parts.filter(Boolean).join('-'))}`.slice(0, 120);
}

function groupedRows(rows, headerNeedle) {
  const headerIndex = rows.findIndex(r => r.some(c => String(c).toLowerCase() === headerNeedle.toLowerCase()));
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex].map(h => h || 'group');
  const out = [];
  let group = '';
  for (const row of rows.slice(headerIndex + 1)) {
    if (!row.some(Boolean)) continue;
    const first = row[0] || '';
    const hasDate = /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(row[1] || '');
    if (first && !hasDate && !/^Total for/i.test(first)) { group = first; continue; }
    if (!hasDate) continue;
    const obj = { group };
    headers.forEach((h, i) => { obj[h || `col${i}`] = row[i] || ''; });
    out.push(obj);
  }
  return out;
}

function simpleTable(rows, headerNeedle) {
  const idx = rows.findIndex(r => r[0] === headerNeedle || r.includes(headerNeedle));
  if (idx < 0) return [];
  const headers = rows[idx].map((h, i) => h || `col${i}`);
  return rows.slice(idx + 1).filter(r => r.some(Boolean) && !/^Total for/i.test(r[0] || '')).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i] || ''; });
    return obj;
  });
}

function upsertById(list, rows) {
  const map = new Map((Array.isArray(list) ? list : []).map(x => [x.id, x]));
  for (const row of rows) map.set(row.id, { ...(map.get(row.id) || {}), ...row });
  return Array.from(map.values());
}

async function supabase(pathname, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`${res.status} ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}

async function main() {
  if (!SUPABASE_KEY) throw new Error('Missing Supabase key env');
  const stateRows = await supabase(`erp_state?id=eq.${encodeURIComponent(STATE_ID)}&select=data&limit=1`);
  const state = (Array.isArray(stateRows) && stateRows[0]?.data && typeof stateRows[0].data === 'object') ? stateRows[0].data : {};
  const summary = {};

  const customerRows = simpleTable(readCsv(files.customers), 'Name');
  const customers = customerRows.filter(r => r.Name && !['.', '0'].includes(r.Name)).map(r => ({
    id: id('QBO-CUST', [r.Name]),
    customerNo: id('CUST', [r.Name]),
    name: r.Name,
    companyName: r['Company name'] || r.Name,
    phone: r.Phone || String(r['Street Address'] || '').match(/\+?\d[\d\s-]{7,}/)?.[0] || '',
    email: r.Email || '',
    city: r.City || '',
    address: [r['Street Address'], r.City, r.State, r.Country, r.Zip].filter(Boolean).join(', '),
    balance: amount(r['Open balance']),
    source: 'QuickBooks Customer Export',
    status: 'Active',
    createdAt: new Date().toISOString()
  }));
  state.customers = upsertById(state.customers, customers);
  summary.customers = customers.length;

  const invoiceMap = new Map();
  function addInvoice(row, customerName, source) {
    const no = row.Number || row['Transaction number'] || row['No.'];
    const total = amount(row.Amount);
    const open = amount(row['Open balance']);
    if (!customerName || !no || !total) return;
    const invId = id('QBO-INV', [customerName, no]);
    invoiceMap.set(invId, {
      id: invId,
      invNo: String(no),
      invoiceNo: String(no),
      customerId: id('QBO-CUST', [customerName]),
      customerName,
      date: dateIso(row.Date),
      dueDate: dateIso(row['Due date'] || row.Date),
      subtotal: Math.round(total / 1.16),
      tax: Math.max(0, total - Math.round(total / 1.16)),
      total,
      paid: Math.max(0, total - open),
      balance: open || 0,
      status: open > 0 ? 'Open' : 'Paid',
      type: 'Sales',
      source: source || 'QuickBooks',
      createdAt: new Date().toISOString()
    });
  }
  for (const r of groupedRows(readCsv(files.customerBalance), 'Date')) if ((r['Transaction type'] || '').includes('Invoice')) addInvoice(r, r.group, 'QuickBooks Customer Balance');
  for (const r of groupedRows(readCsv(files.arDetail), 'Date')) if ((r['Transaction type'] || '').includes('Invoice')) addInvoice(r, r['Customer full name'] || r.group, 'QuickBooks AR Ageing');
  for (const r of groupedRows(readCsv(files.invoicesPayments), 'Date')) if ((r['Transaction type'] || '').includes('Invoice')) addInvoice(r, r.group, 'QuickBooks Invoices and Payments');
  state.invoices = upsertById(state.invoices, Array.from(invoiceMap.values()));
  summary.invoices = invoiceMap.size;

  const payments = groupedRows(readCsv(files.invoicesPayments), 'Date')
    .filter(r => /payment/i.test(r['Transaction type'] || ''))
    .map(r => ({
      id: id('QBO-PAY', [r.group, r['Transaction number'], r.Date, r.Amount]),
      paymentNo: r['Transaction number'] || id('PAY', [r.group, r.Date]),
      customerId: id('QBO-CUST', [r.group]),
      customerName: r.group,
      date: dateIso(r.Date),
      amount: amount(r.Amount),
      method: 'QuickBooks Payment',
      status: 'Completed',
      source: 'QuickBooks Invoices and Payments',
      createdAt: new Date().toISOString()
    }));
  state.payments = upsertById(state.payments, payments);
  summary.payments = payments.length;

  const invRows = simpleTable(readCsv(files.inventory), 'Product/Service').filter(r => r['Product/Service']);
  const products = invRows.map(r => ({
    id: id('QBO-PROD', [r['Product/Service']]),
    name: r['Product/Service'],
    sku: slug(r['Product/Service']).toUpperCase().slice(0, 24),
    supplierName: r['Preferred Supplier'] || '',
    productType: r.Assembly === 'Yes' ? 'Assembly' : 'Inventory',
    reorderPoint: amount(r['Reorder Pt (Min)']),
    source: 'QuickBooks Inventory Status',
    status: 'Active'
  }));
  const inventory = invRows.map(r => ({
    id: id('QBO-STOCK', [r['Product/Service']]),
    productId: id('QBO-PROD', [r['Product/Service']]),
    productName: r['Product/Service'],
    warehouseName: 'Main Store Njiru',
    quantity: amount(r['Qty on Hand']),
    quantityReserved: amount(r['Qty on SO']),
    quantityIncoming: amount(r['Qty on PO']),
    reorderPoint: amount(r['Reorder Pt (Min)']),
    status: r.Order === 'Yes' ? 'Reorder' : 'Active',
    source: 'QuickBooks Inventory Status'
  }));
  state.products = upsertById(state.products, products);
  state.inventory = upsertById(state.inventory, inventory);
  summary.products = products.length;
  summary.inventory = inventory.length;

  const apRows = simpleTable(readCsv(files.apAgeing), 'CURRENT').filter(r => r.group || r.col0);
  const ap = apRows.map(r => {
    const supplier = r.group || r.col0;
    return {
      id: id('QBO-AP', [supplier]),
      supplierId: id('QBO-SUP', [supplier]),
      supplierName: supplier,
      invoiceNo: 'OPENING-AP',
      dueDate: '2026-08-10',
      invoiceAmount: amount(r.Total),
      paidAmount: 0,
      outstandingBalance: amount(r.Total),
      paymentStatus: amount(r.Total) > 0 ? 'Open' : 'Credit',
      agingBucket: amount(r['91 AND OVER']) ? '91+' : amount(r['61 - 90']) ? '61-90' : amount(r['31 - 60']) ? '31-60' : amount(r['1 - 30']) ? '1-30' : 'Current',
      source: 'QuickBooks AP Ageing'
    };
  }).filter(r => r.supplierName && r.outstandingBalance);
  const suppliers = Array.from(new Set([
    ...ap.map(r => r.supplierName),
    ...groupedRows(readCsv(files.openPo), 'Date').map(r => r.group).filter(Boolean)
  ])).map(name => ({ id: id('QBO-SUP', [name]), supplierNo: id('SUP', [name]), name, status: 'Active', source: 'QuickBooks' }));
  state.suppliers = upsertById(state.suppliers, suppliers);
  state.accountsPayable = upsertById(state.accountsPayable, ap);
  state.financeAccountsPayable = upsertById(state.financeAccountsPayable, ap);
  summary.suppliers = suppliers.length;
  summary.accountsPayable = ap.length;

  const poRows = groupedRows(readCsv(files.openPo), 'Date').map(r => ({
    id: id('QBO-PO', [r.group, r.Number, r.Date]),
    poNo: r.Number,
    supplierId: id('QBO-SUP', [r.group]),
    supplierName: r.group,
    date: amount(r['Open Balance']) > 0 ? '2026-08-10' : dateIso(r.Date),
    originalDate: dateIso(r.Date),
    total: amount(r.Amount),
    openBalance: amount(r['Open Balance']),
    status: amount(r['Open Balance']) > 0 ? 'Open' : 'Closed',
    notes: r['Memo/Description'] || '',
    source: 'QuickBooks Open PO'
  })).filter(r => r.poNo);
  state.purchaseOrders = upsertById(state.purchaseOrders, poRows);
  summary.purchaseOrders = poRows.length;

  const expenses = [...groupedRows(readCsv(files.purchasesRecent), 'Date'), ...groupedRows(readCsv(files.purchasesAll), 'Date')]
    .filter(r => /expense|payment/i.test(r['Transaction type'] || '') && amount(r.Amount))
    .slice(-5000)
    .map(r => ({
      id: id('QBO-EXP', [r.Date, r.Number, r.Supplier, r['Memo/Description'], r.Amount]),
      date: dateIso(r.Date),
      category: r['Product/Service full name'] || r['Memo/Description'] || 'QuickBooks Purchase',
      vendor: r.Supplier || r.group || '',
      supplierName: r.Supplier || r.group || '',
      amount: Math.abs(amount(r.Amount)),
      notes: r['Memo/Description'] || r['Transaction type'],
      source: 'QuickBooks Purchases'
    }));
  state.expenses = upsertById(state.expenses, expenses);
  summary.expenses = expenses.length;

  const taxRows = simpleTable(readCsv(files.tax), 'Date').filter(r => r.Date);
  state.taxRecords = upsertById(state.taxRecords, taxRows.map(r => ({
    id: id('QBO-TAX', [r.Date, r['Transaction Type'], r['No.'], r.Name, r.Amount]),
    date: dateIso(r.Date),
    transactionType: r['Transaction Type'],
    reference: r['No.'],
    name: r.Name,
    taxName: r['Tax Name'],
    taxRate: amount(r['Tax Rate']),
    taxableAmount: amount(r['Taxable Amount']),
    liability: amount(r.Amount),
    balance: amount(r.Balance),
    source: 'QuickBooks Tax CSV'
  })));
  summary.taxRecords = taxRows.length;

  const balanceRows = simpleTable(readCsv(files.balanceSummary), 'Distribution account');
  state.qboBalanceSheet = {
    id: 'QBO-BALANCE-2026-08-10',
    asOf: '2026-08-10',
    rows: balanceRows.map(r => ({ account: r['Distribution account'], total: amount(r.Total) })).filter(r => r.account),
    source: 'QuickBooks Balance Sheet Summary',
    importedAt: new Date().toISOString()
  };
  summary.balanceRows = state.qboBalanceSheet.rows.length;

  const journalLines = groupedRows(readCsv(files.journal), 'Date');
  state.qboJournalImport = {
    id: 'QBO-JOURNAL-2020-2026',
    totalLines: journalLines.length,
    importedRecentLines: Math.min(1000, journalLines.length),
    recentLines: journalLines.slice(-1000).map(r => ({
      date: dateIso(r.Date),
      transactionType: r['Transaction type'],
      number: r.Number,
      name: r.Name,
      memo: r['Memo/Description'],
      accountName: r['Account Name'],
      debit: amount(r.Debit),
      credit: amount(r.Credit)
    })),
    note: 'Full QuickBooks journal export is too large for fast ERP state; keep CSV as audit source or migrate to a dedicated journal table.',
    source: 'QuickBooks Journal',
    importedAt: new Date().toISOString()
  };
  summary.journalLinesSeen = journalLines.length;
  summary.journalRecentLinesImported = state.qboJournalImport.importedRecentLines;

  state.qboImportSummary = { importedAt: new Date().toISOString(), files, summary };

  const body = JSON.stringify({ id: STATE_ID, data: state, updated_at: new Date().toISOString() });
  await supabase('erp_state?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body
  });
  console.log(JSON.stringify({ ok: true, summary }, null, 2));
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
