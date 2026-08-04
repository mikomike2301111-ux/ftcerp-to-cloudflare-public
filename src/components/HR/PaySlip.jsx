import React, { useRef, useState } from 'react';

const fmt = (v) => {
  const n = Number(v || 0);
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function PaySlip({ employee, payroll, company, period, onClose, onPrint, user, rpc }) {
  const ref = useRef(null);
  const [emailTo, setEmailTo] = useState(employee?.companyEmail || employee?.email || '');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  const comp = company || {};
  const emp = employee || {};
  const pay = payroll || {};
  const per = period || { from: '—', to: '—', date: '—' };

  const earnings = [
    { label: 'Basic / Attendance pay', current: pay.basePay || pay.basicSalary || 0 },
    { label: 'House Allowance', current: pay.houseAllowance || 0 },
    { label: 'Transport Allowance', current: pay.transportAllowance || 0 },
    { label: 'Medical Allowance', current: pay.medicalAllowance || 0 },
    { label: 'Communication Allowance', current: pay.communicationAllowance || 0 },
    { label: 'Other allowances', current: (pay.totalAllowances || 0) - (pay.houseAllowance || 0) - (pay.transportAllowance || 0) - (pay.medicalAllowance || 0) - (pay.communicationAllowance || 0) },
    { label: 'Overtime Pay', current: pay.overtimePay || 0 },
  ].filter(e => Number(e.current) > 0);

  const customLines = Array.isArray(pay.customDeductions) ? pay.customDeductions : [];
  const deductions = [
    { label: 'PAYE (Income Tax)', current: pay.paye || 0 },
    { label: 'SHIF (Social Health)', current: pay.shif || 0 },
    { label: 'Late attendance deduction', current: pay.lateDeduction || 0 },
    { label: 'Staff Loan', current: pay.loanDeduction || 0 },
    { label: 'SACCO', current: pay.sacco || 0 },
    { label: 'Other fixed deductions', current: pay.otherDeductions || 0 },
    ...customLines.map(cd => ({ label: cd.label || 'Custom deduction', current: cd.amount || 0 })),
  ].filter(d => Number(d.current) > 0);

  const gross = Number(pay.grossPay || 0);
  const totalDed = Number(pay.deductions || deductions.reduce((s, d) => s + Number(d.current || 0), 0));
  const net = Number(pay.netPay || Math.max(0, gross - totalDed));

  async function sendEmail() {
    if (!emailTo) { setMsg('Enter an email address'); return; }
    setSending(true); setMsg('');
    try {
      if (typeof rpc === 'function') {
        await rpc('sendPayslipEmail', [user, {
          to: emailTo,
          employeeId: emp.id,
          employeeName: emp.name,
          netPay: net,
          grossPay: gross,
          period: `${per.from} to ${per.to}`
        }]);
        setMsg(`Payslip sent to ${emailTo}`);
      } else {
        setMsg('Email service unavailable');
      }
    } catch (err) {
      setMsg(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-scrim retractable-overlay" onClick={onClose}>
      <div className="modal-card overlay-scrollable wide" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <header>
          <h2>Payslip — {emp.name || 'Employee'}</h2>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <div className="modal-card-body" ref={ref}>
          <div className="pay-slip-sheet">
            <div className="pay-slip-header">
              <strong>{comp.company_name || 'Farmtrack Biosciences Ltd'}</strong>
              <span>{comp.company_address || 'Njiru, Nairobi'}</span>
              <span>HR: hr@farmtrack.co.ke</span>
            </div>
            <h1 className="pay-slip-title">Pay Stub</h1>
            <div className="pay-slip-info-grid">
              <div><label>Employee</label><span>{emp.name}</span></div>
              <div><label>Department</label><span>{emp.department || pay.department || '—'}</span></div>
              <div><label>Period</label><span>{per.from} → {per.to}</span></div>
              <div><label>Hours (Mon–Sat schedule)</label><span>{pay.hours || 0}h / expected {pay.expectedHours || 0}h</span></div>
            </div>

            <h3>Earnings</h3>
            <table className="simple-table">
              <thead><tr><th>Description</th><th>Amount</th></tr></thead>
              <tbody>
                {earnings.map(e => <tr key={e.label}><td>{e.label}</td><td>{fmt(e.current)}</td></tr>)}
                <tr><td><strong>Gross pay</strong></td><td><strong>{fmt(gross)}</strong></td></tr>
              </tbody>
            </table>

            <h3>Deductions (HR-managed)</h3>
            <table className="simple-table">
              <thead><tr><th>Description</th><th>Amount</th></tr></thead>
              <tbody>
                {deductions.length === 0 && <tr><td colSpan={2}>No deductions</td></tr>}
                {deductions.map((d, i) => <tr key={d.label + i}><td>{d.label}</td><td>{fmt(d.current)}</td></tr>)}
                <tr><td><strong>Total deductions</strong></td><td><strong>{fmt(totalDed)}</strong></td></tr>
              </tbody>
            </table>

            <div className="pay-slip-net">
              <span>Net pay</span>
              <strong>{fmt(net)}</strong>
            </div>
            <p style={{ fontSize: 12, color: '#667085' }}>
              Schedule: Mon–Fri 08:00–17:00 (8h), Sat 08:00–13:00 (5h). PAYE uses Kenya monthly bands with KES 2,400 relief. NSSF and NHIF are not applied. SHIF only if enabled on the employee; all other deductions are set by HR.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16, alignItems: 'center' }}>
            <button type="button" className="primary-action" onClick={() => { onPrint?.(ref); window.print(); }}>Print</button>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 220 }}>
              <span style={{ whiteSpace: 'nowrap' }}>Email to</span>
              <input
                type="email"
                value={emailTo}
                onChange={e => setEmailTo(e.target.value)}
                placeholder="name@example.com"
                style={{ flex: 1, height: 40, borderRadius: 8, border: '1px solid #e4e7ec', padding: '0 10px' }}
              />
            </label>
            <button type="button" className="panel-action-button" disabled={sending} onClick={sendEmail}>
              {sending ? 'Sending…' : 'Send payslip'}
            </button>
          </div>
          {msg && <div className="crm-sheet-message" style={{ marginTop: 8 }}>{msg}</div>}
        </div>
      </div>
    </div>
  );
}
