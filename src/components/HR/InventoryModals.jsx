import React, { useState } from 'react';
import { X, Plus, Trash2, Search, QrCode, Printer, Package, ArrowRightLeft, CheckCircle2, AlertTriangle } from 'lucide-react';

function ModalCard({ title, onClose, children, wide }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal-card ${wide ? 'wide' : ''}`} onClick={e => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function ReceiveStockModal({ user, warehouses = [], suppliers = [], products = [], onClose, onSave }) {
  const warehouseOptions = Array.from(new Set([
    'Njiru Store', 'Finished Goods Store', 'Raw Materials Store',
    ...((warehouses || []).map(w => w?.name).filter(Boolean))
  ]));
  const supplierOptions = Array.from(new Set((suppliers || []).map(s => s?.name).filter(Boolean))).sort();
  const productOptions = (products || []).filter(p => p && p.name).map(p => ({
    name: p.name, sku: p.sku || '', cost: Number(p.costPrice || p.unitCost || 0)
  }));
  const emptyLine = () => ({ productName: '', sku: '', quantity: 1, unitCost: 0, batchNo: '', expiryDate: '', condition: 'Good', notes: '' });
  const [form, setForm] = useState({
    poNo: '', supplier: '', warehouse: 'Njiru Store', deliveryNote: '',
    receivedDate: new Date().toISOString().slice(0, 10), notes: '', items: [emptyLine()]
  });
  const [saving, setSaving] = useState(false);
  const [scanCode, setScanCode] = useState('');
  const num = (v) => Number(v) || 0;
  const addItem = () => setForm({ ...form, items: [...form.items, emptyLine()] });
  const updateItem = (i, field, val) => {
    const next = [...form.items];
    next[i] = { ...next[i], [field]: val };
    setForm({ ...form, items: next });
  };
  const removeItem = (i) => {
    const next = form.items.filter((_, idx) => idx !== i);
    setForm({ ...form, items: next.length ? next : [emptyLine()] });
  };
  const pickProduct = (i, productName) => {
    const p = productOptions.find(x => x.name === productName);
    const next = [...form.items];
    next[i] = {
      ...next[i],
      productName,
      sku: p?.sku || next[i].sku,
      unitCost: p?.cost || next[i].unitCost
    };
    setForm({ ...form, items: next });
  };
  const applyScan = () => {
    const code = String(scanCode || '').trim();
    if (!code) return;
    const match = productOptions.find(p => p.sku === code || p.name.toLowerCase() === code.toLowerCase());
    const line = match
      ? { ...emptyLine(), productName: match.name, sku: match.sku, unitCost: match.cost, quantity: 1 }
      : { ...emptyLine(), productName: code, sku: code, quantity: 1 };
    setForm({ ...form, items: [...form.items.filter(i => i.productName && num(i.quantity)), line] });
    setScanCode('');
  };
  async function submit(e) {
    e.preventDefault();
    const lines = form.items.filter(i => String(i.productName || '').trim() && num(i.quantity) > 0);
    if (!lines.length) { alert('Add at least one product with quantity > 0'); return; }
    if (!form.warehouse) { alert('Select or type a warehouse / store'); return; }
    setSaving(true);
    try {
      await onSave({ ...form, items: lines, supplierName: form.supplier });
    } catch (err) {
      alert(err?.message || 'Receive failed');
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="modal-backdrop overlay-scrollable" onClick={onClose}>
      <div className="modal-card wide overlay-card-scroll" onClick={e => e.stopPropagation()} style={{ maxHeight: '92vh', overflow: 'auto', width: 'min(960px, 96vw)' }}>
        <header><h2>Receive Stock (GRN)</h2><button type="button" onClick={onClose}><X size={18} /></button></header>
        <form className="settings-form-grid receive-stock-form" onSubmit={submit}>
          <fieldset className="settings-fieldset"><legend>Receiving Info</legend>
            <div className="modal-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <label>PO Reference<input value={form.poNo} onChange={e => setForm({ ...form, poNo: e.target.value })} placeholder="PO-001 (optional)" /></label>
              <label>Supplier
                <input list="receive-supplier-list" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="Type or select supplier" />
                <datalist id="receive-supplier-list">{supplierOptions.map(s => <option key={s} value={s} />)}</datalist>
              </label>
              <label>Store
                <input list="receive-warehouse-list" value={form.warehouse} onChange={e => setForm({ ...form, warehouse: e.target.value })} placeholder="Njiru Store" required />
                <datalist id="receive-warehouse-list">{warehouseOptions.map(w => <option key={w} value={w} />)}</datalist>
              </label>
              <label>Delivery Note #<input value={form.deliveryNote} onChange={e => setForm({ ...form, deliveryNote: e.target.value })} placeholder="DN-..." /></label>
              <label>Received Date<input type="date" value={form.receivedDate} onChange={e => setForm({ ...form, receivedDate: e.target.value })} required /></label>
              <label>Notes<input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional" /></label>
            </div>
          </fieldset>
          <fieldset className="settings-fieldset"><legend>Items Received</legend>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'end' }}>
              <label style={{ flex: '1 1 220px' }}>Scan Barcode / SKU
                <input value={scanCode} onChange={e => setScanCode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyScan(); } }} placeholder="Scan or type SKU / product" />
              </label>
              <button type="button" className="secondary-action" onClick={applyScan}><QrCode size={14} /> Apply scan</button>
              <button type="button" className="panel-action-button" onClick={addItem}><Plus size={14} /> Add Line Item</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '42vh', overflow: 'auto' }}>
              {form.items.map((item, i) => (
                <div key={i} style={{ border: '1px solid #e8ecf1', borderRadius: 12, padding: 12, background: '#fafbfc' }}>
                  <div className="modal-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, alignItems: 'end' }}>
                    <label style={{ gridColumn: 'span 2' }}>Product
                      <input list={`receive-product-list-${i}`} value={item.productName} onChange={e => pickProduct(i, e.target.value)} placeholder="Catalogue product or new name" required />
                      <datalist id={`receive-product-list-${i}`}>{productOptions.map(p => <option key={p.name} value={p.name}>{p.sku ? `${p.sku} — ${p.name}` : p.name}</option>)}</datalist>
                    </label>
                    <label>SKU<input value={item.sku} onChange={e => updateItem(i, 'sku', e.target.value)} /></label>
                    <label>Qty<input type="number" min="0.01" step="any" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} required /></label>
                    <label>Unit Cost<input type="number" min="0" step="any" value={item.unitCost} onChange={e => updateItem(i, 'unitCost', e.target.value)} /></label>
                    <label>Batch / Lot<input value={item.batchNo} onChange={e => updateItem(i, 'batchNo', e.target.value)} /></label>
                    <label>Expiry<input type="date" value={item.expiryDate} onChange={e => updateItem(i, 'expiryDate', e.target.value)} /></label>
                    <label>Condition<select value={item.condition} onChange={e => updateItem(i, 'condition', e.target.value)}>{['Good', 'Damaged', 'Quarantine', 'Expired'].map(c => <option key={c}>{c}</option>)}</select></label>
                    <button type="button" className="mini-action" onClick={() => removeItem(i)} style={{ color: '#ef4444', alignSelf: 'end' }}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: '#667085', marginTop: 8 }}>Stock posts into the selected store (default Njiru Store). New product names are added to the catalogue and appear under Inventory.</p>
          </fieldset>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="secondary-action" onClick={onClose}>Cancel</button>
            <button className="primary-action" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Post Goods Receipt'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}


export function DispatchModal({ user, customers, warehouses, onClose, onSave }) {
  const [form, setForm] = useState({
    saleNo: '', customer: '', warehouse: '', deliveryDate: new Date().toISOString().slice(0, 10),
    driver: '', vehicle: '', notes: '',
    items: [{ productName: '', sku: '', quantity: 0, lotNo: '' }]
  });

  const addItem = () => setForm({ ...form, items: [...form.items, { productName: '', sku: '', quantity: 0, lotNo: '' }] });
  const updateItem = (i, field, val) => {
    const next = [...form.items]; next[i] = { ...next[i], [field]: val }; setForm({ ...form, items: next });
  };
  const removeItem = i => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });

  return (
    <ModalCard title="Dispatch / Shipping Order" onClose={onClose} wide>
      <form className="settings-form-grid" onSubmit={e => { e.preventDefault(); onSave(form); }}>
        <fieldset className="settings-fieldset"><legend>Dispatch Details</legend><div>
          <label>Sales Order Ref<input value={form.saleNo} onChange={e => setForm({ ...form, saleNo: e.target.value })} /></label>
          <label>Customer<select value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })}>
            <option value="">Select customer...</option>
            {customers?.map(c => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
          </select></label>
          <label>Dispatch Store<select value={form.warehouse} onChange={e => setForm({ ...form, warehouse: e.target.value })} required>
            {warehouses?.map(w => <option key={w.id || w.name} value={w.name}>{w.name}</option>)}
          </select></label>
          <label>Delivery Date<input type="date" value={form.deliveryDate} onChange={e => setForm({ ...form, deliveryDate: e.target.value })} /></label>
          <label>Driver Name<input value={form.driver} onChange={e => setForm({ ...form, driver: e.target.value })} placeholder="Driver full name" /></label>
          <label>Vehicle Reg<input value={form.vehicle} onChange={e => setForm({ ...form, vehicle: e.target.value })} placeholder="KCA 001A" /></label>
          <label>Notes<textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
        </div></fieldset>
        <fieldset className="settings-fieldset"><legend>Items to Dispatch</legend>
          <button type="button" className="panel-action-button" onClick={addItem} style={{ marginBottom: 8 }}><Plus size={14} /> Add Item</button>
          {form.items.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 6, alignItems: 'end', marginBottom: 6, padding: 10, background: '#f9fafb', borderRadius: 8 }}>
              <label>Product<input value={item.productName} onChange={e => updateItem(i, 'productName', e.target.value)} /></label>
              <label>Qty<input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} /></label>
              <label>Lot/Batch<input value={item.lotNo} onChange={e => updateItem(i, 'lotNo', e.target.value)} /></label>
              <button type="button" className="mini-action" onClick={() => removeItem(i)} style={{ color: '#ef4444' }}><Trash2 size={14} /></button>
            </div>
          ))}
        </fieldset>
        <button className="primary-action" type="submit">Create Dispatch Order</button>
      </form>
    </ModalCard>
  );
}

export function CycleCountModal({ user, warehouses, stockItems, onClose, onSave }) {
  const [form, setForm] = useState({
    warehouse: '', scheduledDate: new Date().toISOString().slice(0, 10),
    items: (stockItems || []).slice(0, 5).map(s => ({
      productId: s.id, productName: s.productName, sku: s.sku,
      systemQuantity: s.quantityAvailable || 0, physicalQuantity: 0, difference: 0, notes: ''
    }))
  });

  const updateCount = (i, val) => {
    const next = [...form.items];
    next[i] = { ...next[i], physicalQuantity: Number(val), difference: Number(val) - next[i].systemQuantity };
    setForm({ ...form, items: next });
  };

  return (
    <ModalCard title="Cycle Count / Audit" onClose={onClose} wide>
      <form className="settings-form-grid" onSubmit={e => { e.preventDefault(); onSave(form); }}>
        <fieldset className="settings-fieldset"><legend>Audit Details</legend><div>
          <label>Warehouse<select value={form.warehouse} onChange={e => setForm({ ...form, warehouse: e.target.value })} required>
            <option value="">Select warehouse...</option>
            {warehouses?.map(w => <option key={w.id || w.name} value={w.name}>{w.name}</option>)}
          </select></label>
          <label>Scheduled Date<input type="date" value={form.scheduledDate} onChange={e => setForm({ ...form, scheduledDate: e.target.value })} /></label>
        </div></fieldset>
        <fieldset className="settings-fieldset"><legend>Count Items (enter physical quantities)</legend>
          <div className="table-wrap">
            <table>
              <thead><tr><th>SKU</th><th>Product</th><th>System Qty</th><th>Physical Count</th><th>Difference</th><th>Notes</th></tr></thead>
              <tbody>
                {form.items.map((item, i) => (
                  <tr key={i}>
                    <td>{item.sku}</td>
                    <td>{item.productName}</td>
                    <td>{item.systemQuantity}</td>
                    <td><input type="number" value={item.physicalQuantity} onChange={e => updateCount(i, e.target.value)}
                      style={{ width: 80, padding: '4px 8px', border: '1px solid #d0d5dd', borderRadius: 6 }} /></td>
                    <td style={{ color: item.difference === 0 ? '#22c55e' : item.difference > 0 ? '#377dff' : '#ef4444', fontWeight: 700 }}>
                      {item.difference > 0 ? '+' : ''}{item.difference}
                    </td>
                    <td><input value={item.notes} onChange={e => { const next = [...form.items]; next[i].notes = e.target.value; setForm({ ...form, items: next }); }}
                      placeholder="Reason if different" style={{ width: 140, padding: '4px 8px', border: '1px solid #d0d5dd', borderRadius: 6 }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>
        <button className="primary-action" type="submit">Submit Count</button>
      </form>
    </ModalCard>
  );
}

export function ReorderModal({ user, suppliers, onClose, onSave }) {
  const [form, setForm] = useState({
    supplier: '', deliveryDate: new Date().toISOString().slice(0, 10), notes: '',
    items: [{ productName: '', sku: '', quantity: 0, unitCost: 0, urgency: 'Normal' }]
  });

  const addItem = () => setForm({ ...form, items: [...form.items, { productName: '', sku: '', quantity: 0, unitCost: 0, urgency: 'Normal' }] });
  const updateItem = (i, field, val) => {
    const next = [...form.items]; next[i] = { ...next[i], [field]: val }; setForm({ ...form, items: next });
  };
  const removeItem = i => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });

  return (
    <ModalCard title="Generate Reorder / Purchase Order" onClose={onClose} wide>
      <form className="settings-form-grid" onSubmit={e => { e.preventDefault(); onSave(form); }}>
        <fieldset className="settings-fieldset"><legend>Order Details</legend><div>
          <label>Preferred Supplier<select value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}>
            <option value="">Select supplier...</option>
            {suppliers?.map(s => <option key={s.id || s.name} value={s.name}>{s.name}</option>)}
          </select></label>
          <label>Expected Delivery<input type="date" value={form.deliveryDate} onChange={e => setForm({ ...form, deliveryDate: e.target.value })} /></label>
          <label>Notes<textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
        </div></fieldset>
        <fieldset className="settings-fieldset"><legend>Items to Reorder</legend>
          <button type="button" className="panel-action-button" onClick={addItem} style={{ marginBottom: 8 }}><Plus size={14} /> Add Item</button>
          {form.items.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 6, alignItems: 'end', marginBottom: 6, padding: 10, background: '#f9fafb', borderRadius: 8 }}>
              <label>Product<input value={item.productName} onChange={e => updateItem(i, 'productName', e.target.value)} /></label>
              <label>Qty<input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} /></label>
              <label>Est. Cost<input type="number" value={item.unitCost} onChange={e => updateItem(i, 'unitCost', Number(e.target.value))} /></label>
              <label>Urgency<select value={item.urgency} onChange={e => updateItem(i, 'urgency', e.target.value)}>
                {['Low', 'Normal', 'High', 'Critical'].map(u => <option key={u}>{u}</option>)}
              </select></label>
              <button type="button" className="mini-action" onClick={() => removeItem(i)} style={{ color: '#ef4444' }}><Trash2 size={14} /></button>
            </div>
          ))}
        </fieldset>
        <button className="primary-action" type="submit">Generate Purchase Order</button>
      </form>
    </ModalCard>
  );
}

export function BinLocationModal({ user, warehouses, onClose, onSave }) {
  const [form, setForm] = useState({
    warehouse: '', zone: 'A', aisle: 1, rack: 1, shelf: 'A1',
    productName: '', sku: '', maxCapacity: 0, currentQuantity: 0
  });

  return (
    <ModalCard title="Configure Bin / Shelf Location" onClose={onClose}>
      <form className="settings-form-grid" onSubmit={e => { e.preventDefault(); onSave(form); }}>
        <fieldset className="settings-fieldset"><legend>Location</legend><div>
          <label>Warehouse<select value={form.warehouse} onChange={e => setForm({ ...form, warehouse: e.target.value })} required>
            <option value="">Select warehouse...</option>
            {warehouses?.map(w => <option key={w.id || w.name} value={w.name}>{w.name}</option>)}
          </select></label>
          <label>Zone<select value={form.zone} onChange={e => setForm({ ...form, zone: e.target.value })}>
            {['A', 'B', 'C', 'D', 'E', 'F'].map(z => <option key={z}>{z}</option>)}
          </select></label>
          <label>Aisle #<input type="number" value={form.aisle} onChange={e => setForm({ ...form, aisle: Number(e.target.value) })} /></label>
          <label>Rack #<input type="number" value={form.rack} onChange={e => setForm({ ...form, rack: Number(e.target.value) })} /></label>
          <label>Shelf<input value={form.shelf} onChange={e => setForm({ ...form, shelf: e.target.value })} placeholder="A1, B2, etc" /></label>
          <label>Max Capacity<input type="number" value={form.maxCapacity} onChange={e => setForm({ ...form, maxCapacity: Number(e.target.value) })} /></label>
        </div></fieldset>
        <fieldset className="settings-fieldset"><legend>Assigned Product (optional)</legend><div>
          <label>Product SKU<input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></label>
          <label>Product Name<input value={form.productName} onChange={e => setForm({ ...form, productName: e.target.value })} /></label>
          <label>Current Quantity<input type="number" value={form.currentQuantity} onChange={e => setForm({ ...form, currentQuantity: Number(e.target.value) })} /></label>
        </div></fieldset>
        <button className="primary-action" type="submit">Save Bin Location</button>
      </form>
    </ModalCard>
  );
}

export function SerialNumberModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({
    productName: '', sku: '', batchNo: '',
    serialNumbers: [''], status: 'Available'
  });

  const addSerial = () => setForm({ ...form, serialNumbers: [...form.serialNumbers, ''] });
  const updateSerial = (i, val) => {
    const next = [...form.serialNumbers]; next[i] = val; setForm({ ...form, serialNumbers: next });
  };
  const removeSerial = i => setForm({ ...form, serialNumbers: form.serialNumbers.filter((_, idx) => idx !== i) });

  return (
    <ModalCard title="Serial Number Registration" onClose={onClose} wide>
      <form className="settings-form-grid" onSubmit={e => { e.preventDefault(); onSave(form); }}>
        <fieldset className="settings-fieldset"><legend>Product Info</legend><div>
          <label>Product Name<input value={form.productName} onChange={e => setForm({ ...form, productName: e.target.value })} required /></label>
          <label>SKU<input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></label>
          <label>Batch Number<input value={form.batchNo} onChange={e => setForm({ ...form, batchNo: e.target.value })} /></label>
          <label>Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            {['Available', 'Reserved', 'Sold', 'Damaged', 'Returned'].map(s => <option key={s}>{s}</option>)}
          </select></label>
        </div></fieldset>
        <fieldset className="settings-fieldset"><legend>Serial Numbers</legend>
          <button type="button" className="panel-action-button" onClick={addSerial} style={{ marginBottom: 8 }}><Plus size={14} /> Add Serial</button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
            {form.serialNumbers.map((sn, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input value={sn} onChange={e => updateSerial(i, e.target.value)} placeholder={`SN-${String(i + 1).padStart(3, '0')}`}
                  style={{ flex: 1, padding: '6px 10px', border: '1px solid #d0d5dd', borderRadius: 6 }} />
                <button type="button" className="mini-action" onClick={() => removeSerial(i)} style={{ color: '#ef4444' }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </fieldset>
        <button className="primary-action" type="submit">Register Serial Numbers</button>
      </form>
    </ModalCard>
  );
}

export function PrintLabelsModal({ user, stockItems, onClose }) {
  const [selected, setSelected] = useState([]);
  const toggleItem = id => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const selectAll = () => setSelected((stockItems || []).map(s => s.id));

  return (
    <ModalCard title="Print Labels / Barcodes" onClose={onClose} wide>
      <div>
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="panel-action-button" onClick={selectAll}>Select All</button>
          <button className="panel-action-button" onClick={() => setSelected([])}>Clear</button>
          <span style={{ fontSize: 12, color: '#667085' }}>{selected.length} items selected</span>
        </div>
        <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
          <table>
            <thead><tr><th><input type="checkbox" checked={selected.length === (stockItems || []).length} onChange={e => e.target.checked ? selectAll() : setSelected([])} /></th>
              <th>SKU</th><th>Product</th><th>Warehouse</th><th>Bin</th><th>Price</th></tr></thead>
            <tbody>
              {(stockItems || []).map(item => (
                <tr key={item.id}>
                  <td><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleItem(item.id)} /></td>
                  <td><strong>{item.sku}</strong></td>
                  <td>{item.productName}</td>
                  <td>{item.warehouseName}</td>
                  <td>{item.shelfLocation || item.binNumber || '-'}</td>
                  <td>{currency(item.unitCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="primary-action" disabled={selected.length === 0} onClick={() => {
            alert(`Printing ${selected.length} label(s)...`);
            onClose();
          }}><Printer size={14} /> Print {selected.length} Label(s)</button>
        </div>
      </div>
    </ModalCard>
  );
}

export function ConsignmentModal({ user, warehouses, suppliers, onClose, onSave }) {
  const [form, setForm] = useState({
    supplier: '', warehouse: '', agreementRef: '', startDate: new Date().toISOString().slice(0, 10),
    commissionRate: 10, paymentTerms: 'Sold Only',
    items: [{ productName: '', sku: '', quantity: 0, agreedPrice: 0 }]
  });

  const addItem = () => setForm({ ...form, items: [...form.items, { productName: '', sku: '', quantity: 0, agreedPrice: 0 }] });
  const updateItem = (i, field, val) => {
    const next = [...form.items]; next[i] = { ...next[i], [field]: val }; setForm({ ...form, items: next });
  };

  return (
    <ModalCard title="Consignment Stock Agreement" onClose={onClose} wide>
      <form className="settings-form-grid" onSubmit={e => { e.preventDefault(); onSave(form); }}>
        <fieldset className="settings-fieldset"><legend>Agreement</legend><div>
          <label>Supplier<select value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} required>
            <option value="">Select supplier...</option>
            {suppliers?.map(s => <option key={s.id || s.name} value={s.name}>{s.name}</option>)}
          </select></label>
          <label>Warehouse<select value={form.warehouse} onChange={e => setForm({ ...form, warehouse: e.target.value })} required>
            {warehouses?.map(w => <option key={w.id || w.name} value={w.name}>{w.name}</option>)}
          </select></label>
          <label>Agreement Ref<input value={form.agreementRef} onChange={e => setForm({ ...form, agreementRef: e.target.value })} /></label>
          <label>Start Date<input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></label>
          <label>Commission Rate (%)<input type="number" value={form.commissionRate} onChange={e => setForm({ ...form, commissionRate: Number(e.target.value) })} /></label>
          <label>Payment Terms<select value={form.paymentTerms} onChange={e => setForm({ ...form, paymentTerms: e.target.value })}>
            {['Sold Only', 'Monthly', 'Bi-Weekly'].map(t => <option key={t}>{t}</option>)}
          </select></label>
        </div></fieldset>
        <fieldset className="settings-fieldset"><legend>Items</legend>
          <button type="button" className="panel-action-button" onClick={addItem} style={{ marginBottom: 8 }}><Plus size={14} /> Add Item</button>
          {form.items.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 6, marginBottom: 6, padding: 10, background: '#f9fafb', borderRadius: 8 }}>
              <label>Product<input value={item.productName} onChange={e => updateItem(i, 'productName', e.target.value)} /></label>
              <label>Qty<input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} /></label>
              <label>Agreed Price<input type="number" value={item.agreedPrice} onChange={e => updateItem(i, 'agreedPrice', Number(e.target.value))} /></label>
            </div>
          ))}
        </fieldset>
        <button className="primary-action" type="submit">Save Consignment Agreement</button>
      </form>
    </ModalCard>
  );
}

export function DamagedStockModal({ user, warehouses, stockItems, onClose, onSave }) {
  const [form, setForm] = useState({
    productName: '', sku: '', warehouse: '', quantity: 0, damageType: 'Physical Damage',
    description: '', dateReported: new Date().toISOString().slice(0, 10), disposition: 'Write-off', photos: false
  });

  return (
    <ModalCard title="Report Damaged Stock" onClose={onClose}>
      <form className="settings-form-grid" onSubmit={e => { e.preventDefault(); onSave(form); }}>
        <fieldset className="settings-fieldset"><legend>Damage Details</legend><div>
          <label>Product<input value={form.productName} onChange={e => setForm({ ...form, productName: e.target.value })} list="stockItems" required /></label>
          <datalist id="stockItems">{(stockItems || []).map(s => <option key={s.id} value={s.productName} />)}</datalist>
          <label>SKU<input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></label>
          <label>Warehouse<select value={form.warehouse} onChange={e => setForm({ ...form, warehouse: e.target.value })}>
            {warehouses?.map(w => <option key={w.id || w.name} value={w.name}>{w.name}</option>)}
          </select></label>
          <label>Quantity<input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: Number(e.target.value) })} required /></label>
          <label>Damage Type<select value={form.damageType} onChange={e => setForm({ ...form, damageType: e.target.value })}>
            {['Physical Damage', 'Water Damage', 'Pest Damage', 'Expired', 'Temperature Damage', 'Theft', 'Other'].map(t => <option key={t}>{t}</option>)}
          </select></label>
          <label>Disposition<select value={form.disposition} onChange={e => setForm({ ...form, disposition: e.target.value })}>
            {['Write-off', 'Return to Supplier', 'Discount Sale', 'Donation', 'Insurance Claim'].map(d => <option key={d}>{d}</option>)}
          </select></label>
          <label>Description<textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required /></label>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.photos} onChange={e => setForm({ ...form, photos: e.target.checked })} />
            Photo Evidence Attached
          </label>
        </div></fieldset>
        <button className="primary-action" type="submit">Report Damage</button>
      </form>
    </ModalCard>
  );
}

export function CrossDockModal({ user, warehouses, onClose, onSave }) {
  const [form, setForm] = useState({
    receivingWarehouse: '', dispatchWarehouse: '', referenceNo: '',
    receivedDate: new Date().toISOString().slice(0, 10), dispatchDate: '',
    items: [{ productName: '', sku: '', quantity: 0, unitCost: 0 }]
  });

  const addItem = () => setForm({ ...form, items: [...form.items, { productName: '', sku: '', quantity: 0, unitCost: 0 }] });
  const updateItem = (i, field, val) => {
    const next = [...form.items]; next[i] = { ...next[i], [field]: val }; setForm({ ...form, items: next });
  };

  return (
    <ModalCard title="Cross-Docking Transfer" onClose={onClose} wide>
      <form className="settings-form-grid" onSubmit={e => { e.preventDefault(); onSave(form); }}>
        <fieldset className="settings-fieldset"><legend>Cross-Dock Routing</legend><div>
          <label>Receiving Store<select value={form.receivingWarehouse} onChange={e => setForm({ ...form, receivingWarehouse: e.target.value })} required>
            <option value="">Select receiving...</option>
            {warehouses?.map(w => <option key={w.id || w.name} value={w.name}>{w.name}</option>)}
          </select></label>
          <label>Dispatch To<select value={form.dispatchWarehouse} onChange={e => setForm({ ...form, dispatchWarehouse: e.target.value })} required>
            <option value="">Select destination...</option>
            {warehouses?.map(w => <option key={w.id || w.name} value={w.name}>{w.name}</option>)}
          </select></label>
          <label>Reference/DN #<input value={form.referenceNo} onChange={e => setForm({ ...form, referenceNo: e.target.value })} /></label>
          <label>Received Date<input type="date" value={form.receivedDate} onChange={e => setForm({ ...form, receivedDate: e.target.value })} /></label>
          <label>Schedule Dispatch<input type="date" value={form.dispatchDate} onChange={e => setForm({ ...form, dispatchDate: e.target.value })} /></label>
        </div></fieldset>
        <fieldset className="settings-fieldset"><legend>Items</legend>
          <button type="button" className="panel-action-button" onClick={addItem} style={{ marginBottom: 8 }}><Plus size={14} /> Add Item</button>
          {form.items.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 6, marginBottom: 6, padding: 10, background: '#f9fafb', borderRadius: 8 }}>
              <label>Product<input value={item.productName} onChange={e => updateItem(i, 'productName', e.target.value)} /></label>
              <label>Qty<input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} /></label>
              <label>Unit Cost<input type="number" value={item.unitCost} onChange={e => updateItem(i, 'unitCost', Number(e.target.value))} /></label>
            </div>
          ))}
        </fieldset>
        <button className="primary-action" type="submit">Save Cross-Dock Order</button>
      </form>
    </ModalCard>
  );
}
