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
  purchaseList: 'Farmtrack Biosciences Ltd_Purchase List.csv',
  purchasesRecent: 'Farmtrack Biosciences Ltd_Purchases by Location Detail.csv',
  purchasesAll: 'Farmtrack Biosciences Ltd_Purchases by Location Detail (1).csv',
  salesA: 'Farmtrack Biosciences Ltd_Sales by Customer Type Detail.csv',
  salesB: 'Farmtrack Biosciences Ltd_Sales by Customer Type Detail (1).csv',
  salesC: 'Farmtrack Biosciences Ltd_Sales by Customer Type Detail (2).csv',
  unpaidBills: 'Farmtrack Biosciences Ltd_Unpaid Bills Report.csv',
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
    headers.forEach((h, i) => {
      if (i === 0 && h === 'group') return;
      obj[h || `col${i}`] = row[i] || '';
    });
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

function replaceImported(list, prefix, rows) {
  const keep = (Array.isArray(list) ? list : []).filter(row => !String(row?.id || '').startsWith(prefix));
  return upsertById(keep, rows);
}

function recentByDate(rows, limit) {
  return [...rows].sort((a, b) => String(b.date || b.dueDate || '').localeCompare(String(a.date || a.dueDate || ''))).slice(0, limit);
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
  const allInvoices = Array.from(invoiceMap.values());
  const liveInvoices = [
    ...allInvoices.filter(inv => amount(inv.balance) !== 0),
    ...recentByDate(allInvoices.filter(inv => amount(inv.balance) === 0), 500)
  ];
  state.invoices = replaceImported(state.invoices, 'QBO-INV', liveInvoices);
  summary.invoicesSeen = invoiceMap.size;
  summary.invoicesImportedLive = liveInvoices.length;

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
  const livePayments = recentByDate(payments, 1000);
  state.payments = replaceImported(state.payments, 'QBO-PAY', livePayments);
  summary.paymentsSeen = payments.length;
  summary.paymentsImportedLive = livePayments.length;

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
  const unpaidBills = groupedRows(readCsv(files.unpaidBills), 'Date')
    .filter(r => r.group && amount(r['Open balance']))
    .map(r => ({
      id: id('QBO-BILL', [r.group, r.Number, r.Date, r['Open balance']]),
      supplierInvoiceId: id('QBO-SUPINV', [r.group, r.Number, r.Date, r['Open balance']]),
      supplierId: id('QBO-SUP', [r.group]),
      supplierName: r.group,
      invoiceNo: r.Number || `BILL-${dateIso(r.Date)}-${slug(r.group).slice(0, 16)}`,
      dueDate: dateIso(r['Due date'] || r.Date),
      invoiceAmount: amount(r.Amount),
      paidAmount: Math.max(0, amount(r.Amount) - amount(r['Open balance'])),
      outstandingBalance: amount(r['Open balance']),
      paymentStatus: amount(r['Open balance']) > 0 ? 'Open' : 'Credit',
      agingBucket: amount(r['Past due']) > 90 ? '91+' : amount(r['Past due']) > 60 ? '61-90' : amount(r['Past due']) > 30 ? '31-60' : amount(r['Past due']) > 0 ? '1-30' : 'Current',
      source: 'QuickBooks Unpaid Bills'
    }));
  const allAp = [...ap, ...unpaidBills];
  const purchaseListRows = simpleTable(readCsv(files.purchaseList), 'Transaction id')
    .filter(r => r['Transaction id'] && amount(r.Amount))
    .map(r => ({
      id: id('QBO-PURCHASE-LIST', [r['Transaction id'], r.Date, r.Name, r.Number, r['Memo/Description'], r.Amount]),
      date: dateIso(r.Date),
      transactionId: r['Transaction id'],
      number: r.Number || '',
      category: r['Memo/Description'] || 'QuickBooks purchase',
      vendor: r.Name || '',
      supplierName: r.Name || '',
      amount: Math.abs(amount(r.Amount)),
      taxAmount: Math.abs(amount(r['Tax amount'])),
      taxName: r['Tax name'] || '',
      currency: r.Currency || 'KES',
      source: 'QuickBooks Purchase List'
    }));
  const suppliers = Array.from(new Set([
    ...allAp.map(r => r.supplierName),
    ...groupedRows(readCsv(files.openPo), 'Date').map(r => r.group).filter(Boolean),
    ...purchaseListRows.map(r => r.supplierName).filter(Boolean)
  ])).map(name => ({ id: id('QBO-SUP', [name]), supplierNo: id('SUP', [name]), name, status: 'Active', source: 'QuickBooks' }));
  state.suppliers = upsertById(state.suppliers, suppliers);
  state.accountsPayable = upsertById(state.accountsPayable, allAp);
  state.financeAccountsPayable = upsertById(state.financeAccountsPayable, allAp);
  state.supplierInvoices = upsertById(state.supplierInvoices, unpaidBills.map(row => ({
    id: row.supplierInvoiceId,
    invoiceNo: row.invoiceNo,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    invoiceDate: row.dueDate,
    dueDate: row.dueDate,
    invoiceAmount: row.invoiceAmount,
    paidAmount: row.paidAmount,
    outstandingBalance: row.outstandingBalance,
    status: row.paymentStatus,
    source: row.source
  })));
  summary.suppliers = suppliers.length;
  summary.accountsPayable = allAp.length;
  summary.unpaidBills = unpaidBills.length;

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
  state.purchaseOrders = replaceImported(state.purchaseOrders, 'QBO-PO', poRows);
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
  const compactPurchaseList = recentByDate(purchaseListRows, 1000);
  const liveExpenses = recentByDate(expenses, 1000);
  state.expenses = replaceImported(replaceImported(state.expenses, 'QBO-EXP', liveExpenses), 'QBO-PURCHASE-LIST', compactPurchaseList);
  state.qboPurchaseListImport = {
    id: 'QBO-PURCHASE-LIST-2022-2026',
    totalRows: purchaseListRows.length,
    importedRecentRows: compactPurchaseList.length,
    recentRows: compactPurchaseList,
    note: 'Full QuickBooks Purchase List is compacted for fast ERP loading; recent rows are also available in expenses.',
    source: 'QuickBooks Purchase List',
    importedAt: new Date().toISOString()
  };
  summary.expensesSeen = expenses.length;
  summary.expensesImportedLive = liveExpenses.length;
  summary.purchaseListSeen = purchaseListRows.length;
  summary.purchaseListImportedLive = compactPurchaseList.length;

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
    importedRecentLines: Math.min(300, journalLines.length),
    recentLines: journalLines.slice(-300).map(r => ({
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

  const salesLines = [
    ...groupedRows(readCsv(files.salesA), 'Date'),
    ...groupedRows(readCsv(files.salesB), 'Date'),
    ...groupedRows(readCsv(files.salesC), 'Date')
  ].filter(r => /invoice|sales receipt/i.test(r['Transaction type'] || '') && amount(r.Amount));
  state.qboSalesLineImport = {
    id: 'QBO-SALES-LINES-2020-2026',
    totalLines: salesLines.length,
    importedRecentLines: Math.min(500, salesLines.length),
    recentLines: salesLines.slice(-500).map(r => ({
      date: dateIso(r.Date),
      transactionType: r['Transaction type'],
      number: r.Number,
      customerGroup: r.group || '',
      productName: r['Product/Service full name'] || 'Services',
      memo: r['Memo/Description'] || '',
      quantity: amount(r.Qty),
      unitPrice: amount(r['Sales price']),
      amount: amount(r.Amount),
      balance: amount(r.Balance)
    })),
    note: 'Sales detail exports are retained as line-level import audit because customer names are not present on every row.',
    source: 'QuickBooks Sales by Customer Type Detail',
    importedAt: new Date().toISOString()
  };
  summary.salesLinesSeen = salesLines.length;
  summary.salesRecentLinesImported = state.qboSalesLineImport.importedRecentLines;

  state.qboImportSummary = { importedAt: new Date().toISOString(), files, summary };

  const body = JSON.stringify({ id: STATE_ID, data: state, updated_at: new Date().toISOString() });
  try {
    await supabase('erp_state?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body
    });
  } catch (error) {
    if (!/statement timeout|57014|timeout/i.test(error.message || '')) throw error;
    await supabase(`erp_state?id=eq.${encodeURIComponent(STATE_ID)}`, { method: 'DELETE' });
    await supabase('erp_state', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body
    });
  }
  console.log(JSON.stringify({ ok: true, summary }, null, 2));
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
