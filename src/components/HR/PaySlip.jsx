import React, { useRef, useState, useMemo } from 'react';

const LOGO = 'https://i.postimg.cc/CM9BdKbH/logo-ftc.png';
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

  const earnings = useMemo(() => {
    const rows = [
      { label: 'Basic / Attendance pay', current: Number(pay.basePay || pay.basicSalary || 0) },
      { label: 'House Allowance', current: Number(pay.houseAllowance || 0) },
      { label: 'Transport Allowance', current: Number(pay.transportAllowance || 0) },
      { label: 'Medical Allowance', current: Number(pay.medicalAllowance || 0) },
      { label: 'Communication Allowance', current: Number(pay.communicationAllowance || 0) },
      { label: 'Other allowances', current: Math.max(0, Number(pay.totalAllowances || 0) - Number(pay.houseAllowance || 0) - Number(pay.transportAllowance || 0) - Number(pay.medicalAllowance || 0) - Number(pay.communicationAllowance || 0)) },
      { label: 'Overtime Pay', current: Number(pay.overtimePay || 0) },
    ];
    return rows.filter(e => e.current > 0.001);
  }, [pay]);

  const deductions = useMemo(() => {
    const customLines = Array.isArray(pay.customDeductions) ? pay.customDeductions : [];
    // Also pull live employee custom deductions if payroll row omitted detail
    const empCustom = Array.isArray(emp.customDeductions) ? emp.customDeductions.filter(cd => cd.active !== false) : [];
    const mergedCustom = customLines.length ? customLines : empCustom.map(cd => ({
      label: cd.label || 'Custom deduction',
      amount: cd.method === 'Percent' ? (Number(pay.grossPay || 0) * Number(cd.percent || 0) / 100) : Number(cd.amount || 0)
    }));
    const rows = [
      { label: 'PAYE (Income Tax)', current: Number(pay.paye || 0) },
      { label: 'SHIF (Social Health)', current: Number(pay.shif || 0) },
      { label: 'Late attendance deduction', current: Number(pay.lateDeduction || 0) },
      { label: 'Staff Loan', current: Number(pay.loanDeduction || 0) },
      { label: 'SACCO', current: Number(pay.sacco || 0) },
      { label: 'Other fixed deductions', current: Number(pay.otherDeductions || 0) },
      ...mergedCustom.map(cd => ({ label: cd.label || 'Custom deduction', current: Number(cd.amount || cd.current || 0) })),
    ];
    return rows.filter(d => d.current > 0.001);
  }, [pay, emp]);

  const gross = Number(pay.grossPay || earnings.reduce((s, e) => s + e.current, 0) || 0);
  const totalDed = deductions.reduce((s, d) => s + Number(d.current || 0), 0);
  const net = Number(pay.netPay != null ? pay.netPay : Math.max(0, gross - totalDed));

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
          deductions: totalDed,
          period: `${per.from} to ${per.to}`
        }]);
        setMsg(`Payslip sent to ${emailTo}`);
      } else setMsg('Email service unavailable');
    } catch (err) {
      setMsg(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  function handlePrint() {
    onPrint?.(ref);
    window.print();
  }

  return (
    <div className="modal-scrim retractable-overlay payslip-overlay" onClick={onClose}>
      <div className="modal-card overlay-scrollable wide payslip-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 780 }}>
        <header className="no-print">
          <h2>Payslip — {emp.name || 'Employee'}</h2>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <div className="modal-card-body" ref={ref}>
          <div className="pay-slip-sheet" id="payslip-print-root">
            <div className="pay-slip-brand">
              <img src={LOGO} alt="FarmTrack BioSciences" className="pay-slip-logo" />
              <div>
                <strong>{comp.company_name || 'FarmTrack BioSciences Ltd'}</strong>
                <span>{comp.company_address || 'Njiru, Nairobi, Kenya'}</span>
                <span>HR · hr@farmtrack.co.ke · {comp.company_phone || ''}</span>
              </div>
            </div>
            <h1 className="pay-slip-title">Employee Payslip</h1>
            <div className="pay-slip-info-grid">
              <div><label>Employee</label><span>{emp.name}</span></div>
              <div><label>Employee No</label><span>{emp.employeeNo || emp.id || '—'}</span></div>
              <div><label>Department</label><span>{emp.department || pay.department || '—'}</span></div>
              <div><label>Position</label><span>{emp.position || emp.jobTitle || '—'}</span></div>
              <div><label>Pay period</label><span>{per.from} → {per.to}</span></div>
              <div><label>Hours</label><span>{pay.hours || 0}h / expected {pay.expectedHours || 0}h</span></div>
            </div>

            <div className="pay-slip-two-col">
              <div>
                <h3>Earnings</h3>
                <table className="simple-table pay-slip-table">
                  <thead><tr><th>Description</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    {earnings.length === 0 && <tr><td colSpan={2}>No earnings lines</td></tr>}
                    {earnings.map(e => (
                      <tr key={e.label}><td>{e.label}</td><td className="num">{fmt(e.current)}</td></tr>
                    ))}
                    <tr className="total-row"><td><strong>Gross pay</strong></td><td className="num"><strong>{fmt(gross)}</strong></td></tr>
                  </tbody>
                </table>
              </div>
              <div>
                <h3>Deductions</h3>
                <table className="simple-table pay-slip-table">
                  <thead><tr><th>Description</th><th className="num">Amount</th></tr></thead>
                  <tbody>
                    {deductions.length === 0 && <tr><td colSpan={2}>No deductions</td></tr>}
                    {deductions.map((d, i) => (
                      <tr key={d.label + i}><td>{d.label}</td><td className="num">{fmt(d.current)}</td></tr>
                    ))}
                    <tr className="total-row"><td><strong>Total deductions</strong></td><td className="num"><strong>{fmt(totalDed)}</strong></td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pay-slip-net">
              <span>Net pay (Gross − Total deductions)</span>
              <strong>{fmt(net)}</strong>
            </div>
            <div className="pay-slip-verify">
              <span>Gross {fmt(gross)}</span>
              <span>− Deductions {fmt(totalDed)}</span>
              <span>= Net {fmt(net)}</span>
            </div>
            <p className="pay-slip-footnote">
              Schedule: Mon–Fri 08:00–17:00, Sat 08:00–13:00. PAYE uses Kenya monthly bands with KES 2,400 relief.
              Custom deduction names and amounts are set by HR on the employee record. Computer-generated — valid without signature.
            </p>
          </div>

          <div className="no-print payslip-actions">
            <button type="button" className="primary-action" onClick={handlePrint}>Print / Save PDF</button>
            <label className="payslip-email-label">
              <span>Email to</span>
              <input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="name@example.com" />
            </label>
            <button type="button" className="panel-action-button" disabled={sending} onClick={sendEmail}>
              {sending ? 'Sending…' : 'Send payslip'}
            </button>
          </div>
          {msg && <div className="crm-sheet-message no-print" style={{ marginTop: 8 }}>{msg}</div>}
        </div>
      </div>
    </div>
  );
}
