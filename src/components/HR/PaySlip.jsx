import React, { useRef, useState, useMemo } from 'react';

const LOGO = 'https://erpftc.vercel.app/logo-ftc.webp';
const GREEN = '#3b8c5a';
const LIME = '#c8e86c';

const money = (v) => {
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
  const per = period || {};

  const periodStart = per.from || per.start || pay.periodStart || '—';
  const periodEnd = per.to || per.end || pay.periodEnd || '—';
  const payDate = per.date || pay.payDate || new Date().toISOString().slice(0, 10);
  const stubNo = pay.stubNo || pay.payrollNo || `PS-${String(emp.employeeNo || emp.id || '000').slice(-6)}-${String(payDate).replace(/-/g, '').slice(0, 8)}`;

  const hours = Number(pay.hours || 0);
  const expectedHours = Number(pay.expectedHours || 0);
  const hourlyRate = hours > 0 ? Number(pay.basePay || pay.basicSalary || 0) / hours : Number(emp.hourlyRate || 0);

  const earnings = useMemo(() => {
    const rows = [
      {
        label: 'Basic / Attendance pay',
        rate: hourlyRate || Number(emp.salary || 0) / 176,
        qty: hours || expectedHours || 1,
        current: Number(pay.basePay || pay.basicSalary || 0),
        ytd: Number(pay.ytdBasePay || pay.basePay || pay.basicSalary || 0)
      },
      { label: 'House Allowance', rate: null, qty: null, current: Number(pay.houseAllowance || 0), ytd: Number(pay.ytdHouseAllowance || pay.houseAllowance || 0) },
      { label: 'Transport Allowance', rate: null, qty: null, current: Number(pay.transportAllowance || 0), ytd: Number(pay.ytdTransportAllowance || pay.transportAllowance || 0) },
      { label: 'Medical Allowance', rate: null, qty: null, current: Number(pay.medicalAllowance || 0), ytd: Number(pay.ytdMedicalAllowance || pay.medicalAllowance || 0) },
      { label: 'Communication Allowance', rate: null, qty: null, current: Number(pay.communicationAllowance || 0), ytd: Number(pay.ytdCommunicationAllowance || pay.communicationAllowance || 0) },
      { label: 'Overtime Pay', rate: null, qty: Number(pay.overtimeHours || 0) || null, current: Number(pay.overtimePay || 0), ytd: Number(pay.ytdOvertimePay || pay.overtimePay || 0) },
      { label: 'Other allowances', rate: null, qty: null, current: Math.max(0, Number(pay.totalAllowances || 0) - Number(pay.houseAllowance || 0) - Number(pay.transportAllowance || 0) - Number(pay.medicalAllowance || 0) - Number(pay.communicationAllowance || 0)), ytd: 0 },
    ];
    return rows.filter(r => Number(r.current) > 0.001);
  }, [pay, emp, hours, expectedHours, hourlyRate]);

  const deductions = useMemo(() => {
    const customLines = Array.isArray(pay.customDeductions) ? pay.customDeductions : [];
    const empCustom = Array.isArray(emp.customDeductions) ? emp.customDeductions.filter(cd => cd.active !== false) : [];
    const merged = customLines.length ? customLines : empCustom.map(cd => ({
      label: cd.label || 'Custom',
      amount: cd.method === 'Percent' ? Number(pay.grossPay || 0) * Number(cd.percent || 0) / 100 : Number(cd.amount || 0)
    }));
    const rows = [
      { label: 'PAYE (Income Tax)', current: Number(pay.paye || 0), ytd: Number(pay.ytdPaye || pay.paye || 0) },
      { label: 'SHIF (Social Health)', current: Number(pay.shif || 0), ytd: Number(pay.ytdShif || pay.shif || 0) },
      { label: 'Late attendance', current: Number(pay.lateDeduction || 0), ytd: Number(pay.ytdLateDeduction || pay.lateDeduction || 0) },
      { label: 'Staff Loan', current: Number(pay.loanDeduction || 0), ytd: Number(pay.ytdLoanDeduction || pay.loanDeduction || 0) },
      { label: 'SACCO', current: Number(pay.sacco || 0), ytd: Number(pay.ytdSacco || pay.sacco || 0) },
      { label: 'Other fixed deductions', current: Number(pay.otherDeductions || 0), ytd: Number(pay.ytdOtherDeductions || pay.otherDeductions || 0) },
      ...merged.map(cd => ({
        label: cd.label || 'Custom deduction',
        current: Number(cd.amount || cd.current || 0),
        ytd: Number(cd.ytd || cd.amount || cd.current || 0)
      })),
    ];
    return rows.filter(r => Number(r.current) > 0.001);
  }, [pay, emp]);

  const gross = Number(pay.grossPay || earnings.reduce((s, e) => s + e.current, 0) || 0);
  const totalDed = deductions.reduce((s, d) => s + Number(d.current || 0), 0);
  const net = Number(pay.netPay != null ? pay.netPay : Math.max(0, gross - totalDed));
  const ytdGross = Number(pay.ytdGrossPay || gross);
  const ytdDed = Number(pay.ytdDeductions || totalDed);
  const ytdNet = Number(pay.ytdNetPay || Math.max(0, ytdGross - ytdDed));

  async function sendEmail() {
    if (!emailTo) { setMsg('Enter an email address'); return; }
    setSending(true); setMsg('');
    try {
      if (typeof rpc === 'function') {
        await rpc('sendPayslipEmail', [user, {
          to: emailTo, employeeId: emp.id, employeeName: emp.name,
          netPay: net, grossPay: gross, deductions: totalDed,
          period: `${periodStart} to ${periodEnd}`
        }]);
        setMsg(`Payslip sent to ${emailTo}`);
      } else setMsg('Email service unavailable');
    } catch (err) {
      setMsg(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-scrim retractable-overlay payslip-overlay" onClick={onClose}>
      <div className="modal-card overlay-scrollable wide payslip-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 900 }}>
        <header className="no-print">
          <h2>Payslip — {emp.name || 'Employee'}</h2>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <div className="modal-card-body">
          <div className="paystub-sheet" id="payslip-print-root" ref={ref}>
            {/* Header */}
            <div className="paystub-top">
              <div className="paystub-company">
                <img src={LOGO} alt="FarmTrack" className="paystub-logo" />
                <div>
                  <div className="paystub-company-name">{comp.company_name || 'FarmTrack BioSciences Ltd'}</div>
                  <div>{comp.company_address || 'Njiru, Nairobi, Kenya'}</div>
                  <div>Phone: {comp.company_phone || '+254'}</div>
                  <div>{comp.company_email || 'hr@farmtrack.co.ke'}</div>
                </div>
              </div>
              <div className="paystub-meta">
                <div className="paystub-title">PAY STUB</div>
                <div><span>Pay Stub Number:</span> {stubNo}</div>
                <div><span>Period Start:</span> {periodStart}</div>
                <div><span>Period End:</span> {periodEnd}</div>
                <div><span>Pay Date:</span> {payDate}</div>
                <div><span>Employee No:</span> {emp.employeeNo || '—'}</div>
              </div>
            </div>

            {/* Employee band */}
            <div className="paystub-emp-band">
              <div>
                <div><strong>Department:</strong> {emp.department || pay.department || '—'}</div>
                <div><strong>Position:</strong> {emp.position || emp.jobTitle || '—'}</div>
                <div><strong>National ID:</strong> {emp.nationalId || emp.idNumber || '—'}</div>
                <div><strong>KRA PIN:</strong> {emp.kraPin || '—'}</div>
              </div>
              <div>
                <div className="paystub-emp-name">{emp.name || '—'}</div>
                <div>{emp.address || emp.city || 'Nairobi, Kenya'}</div>
                <div>{emp.companyEmail || emp.email || '—'}</div>
                <div>{emp.phone || '—'}</div>
              </div>
            </div>

            {/* Earnings */}
            <table className="paystub-table">
              <thead>
                <tr>
                  <th>Earnings</th>
                  <th className="num">Rate</th>
                  <th className="num">Hrs/Qty</th>
                  <th className="num">This Period</th>
                  <th className="num">Year to Date</th>
                </tr>
              </thead>
              <tbody>
                {earnings.length === 0 && (
                  <tr><td colSpan={5}>No earnings for this period</td></tr>
                )}
                {earnings.map(e => (
                  <tr key={e.label}>
                    <td>{e.label}</td>
                    <td className="num">{e.rate != null && e.rate > 0 ? money(e.rate) : '—'}</td>
                    <td className="num">{e.qty != null && e.qty > 0 ? Number(e.qty).toLocaleString('en-KE', { maximumFractionDigits: 2 }) : '—'}</td>
                    <td className="num">{money(e.current)}</td>
                    <td className="num">{money(e.ytd || e.current)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="paystub-bar">
              <span>GROSS EARNINGS</span>
              <span className="paystub-bar-vals">
                <strong>{money(gross)}</strong>
                <strong>{money(ytdGross)}</strong>
              </span>
            </div>

            {/* Deductions */}
            <table className="paystub-table" style={{ marginTop: 18 }}>
              <thead>
                <tr>
                  <th>Deductions</th>
                  <th>Type</th>
                  <th className="num">This Period</th>
                  <th className="num">Year to Date</th>
                </tr>
              </thead>
              <tbody>
                {deductions.length === 0 && (
                  <tr><td colSpan={4}>No deductions for this period</td></tr>
                )}
                {deductions.map((d, i) => (
                  <tr key={d.label + i}>
                    <td>{d.label}</td>
                    <td>Deduction</td>
                    <td className="num">{money(d.current)}</td>
                    <td className="num">{money(d.ytd || d.current)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="paystub-bar">
              <span>TOTAL DEDUCTIONS</span>
              <span className="paystub-bar-vals">
                <strong>{money(totalDed)}</strong>
                <strong>{money(ytdDed)}</strong>
              </span>
            </div>

            <div className="paystub-net-row">
              <span className="paystub-net-label">NET PAYMENT</span>
              <span className="paystub-net-amount">{money(net)}</span>
            </div>

            <table className="paystub-ytd-foot">
              <thead>
                <tr>
                  <th>YTD GROSS EARNINGS</th>
                  <th>YTD TOTAL DEDUCTIONS</th>
                  <th>YTD NET PAYMENT</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{money(ytdGross)}</td>
                  <td>{money(ytdDed)}</td>
                  <td>{money(ytdNet)}</td>
                </tr>
              </tbody>
            </table>

            <p className="paystub-note">
              Schedule: Mon–Fri 08:00–17:00, Sat 08:00–13:00. PAYE uses Kenya monthly bands with KES 2,400 relief.
              Gross {money(gross)} − Deductions {money(totalDed)} = Net {money(net)}. Computer-generated payslip — FarmTrack BioSciences Ltd.
            </p>
          </div>

          <div className="no-print payslip-actions">
            <button type="button" className="primary-action" onClick={() => { onPrint?.(ref); window.print(); }}>Print / Save PDF</button>
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
