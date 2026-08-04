import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2, Users, UserPlus } from 'lucide-react';

function ModalCard({ title, onClose, children, wide }) {
  return (
    <div className="modal-scrim retractable-overlay" onClick={onClose}>
      <div className={`modal-card overlay-scrollable ${wide ? 'wide wide-full' : ''}`} onClick={e => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="modal-card-body overlay-scroll-body">{children}</div>
      </div>
    </div>
  );
}

export function DepartmentSetupModal({ user, onClose, onSave, initial, employees = [] }) {
  const [form, setForm] = useState(initial && initial.id ? { ...initial } : {
    name: '', code: '', manager: '', description: '', budget: 0, location: '',
    costCenter: '', parentDepartment: '', status: 'Active', headcount: 0
  });
  const [query, setQuery] = useState('');
  const isEdit = Boolean(form.id);
  const deptName = form.name || '';

  const assignedIds = useMemo(() => {
    const fromForm = Array.isArray(form.memberIds) ? form.memberIds : null;
    if (fromForm) return new Set(fromForm);
    return new Set(
      (employees || [])
        .filter(e => e.department === deptName && e.status !== 'Deleted')
        .map(e => e.id)
    );
  }, [form.memberIds, employees, deptName]);

  const [selected, setSelected] = useState(() => new Set(assignedIds));

  // keep selection when department name changes for new depts
  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = (employees || []).filter(e => {
    if (e.status === 'Deleted') return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${e.name} ${e.position} ${e.email} ${e.department}`.toLowerCase().includes(q);
  });

  const submit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      memberIds: Array.from(selected),
      assignExisting: true
    });
  };

  return (
    <ModalCard title={isEdit ? 'Edit Department' : 'Add Department'} onClose={onClose} wide>
      <form className="settings-form-grid" onSubmit={submit}>
        <fieldset className="settings-fieldset"><legend>Department details</legend>
          <div className="modal-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>Department name<input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Field Sales" /></label>
            <label>Code<input value={form.code || ''} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="e.g. FS-01" /></label>
            <label>Manager<input value={form.manager || ''} onChange={e => setForm({ ...form, manager: e.target.value })} placeholder="Department head" list="mgr-list" /></label>
            <datalist id="mgr-list">{(employees || []).map(e => <option key={e.id} value={e.name} />)}</datalist>
            <label>Parent department<input value={form.parentDepartment || ''} onChange={e => setForm({ ...form, parentDepartment: e.target.value })} placeholder="Optional" /></label>
            <label>Status<select value={form.status || 'Active'} onChange={e => setForm({ ...form, status: e.target.value })}>
              {['Active', 'Inactive', 'Restructuring'].map(s => <option key={s}>{s}</option>)}
            </select></label>
            <label>Headcount target<input type="number" value={form.headcount || 0} onChange={e => setForm({ ...form, headcount: Number(e.target.value) })} /></label>
            <label>Location<input value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Njiru HQ" /></label>
            <label>Cost center<input value={form.costCenter || ''} onChange={e => setForm({ ...form, costCenter: e.target.value })} /></label>
            <label>Annual budget (KES)<input type="number" value={form.budget || 0} onChange={e => setForm({ ...form, budget: Number(e.target.value) })} /></label>
            <label className="span-2">Description<textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="What this department does" /></label>
          </div>
        </fieldset>

        <fieldset className="settings-fieldset"><legend><Users size={14} style={{ verticalAlign: 'middle' }} /> Assign existing people ({selected.size})</legend>
          <p style={{ margin: '0 0 10px', color: '#667085', fontSize: 13 }}>Tick people to place them in this department. Untick to leave them in their current department until you reassign them.</p>
          <input
            type="search"
            placeholder="Search employees by name, position, email..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ width: '100%', marginBottom: 10, height: 40, borderRadius: 8, border: '1px solid #e4e7ec', padding: '0 12px' }}
          />
          <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid #eef0f3', borderRadius: 10 }}>
            {filtered.length === 0 && <div className="empty-state" style={{ padding: 16 }}>No employees match. Add people in Directory first.</div>}
            {filtered.map(emp => {
              const checked = selected.has(emp.id);
              const otherDept = emp.department && emp.department !== deptName ? emp.department : '';
              return (
                <label key={emp.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #f2f4f7', cursor: 'pointer' }}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(emp.id)} />
                  <span className="rep-avatar sm" style={{ background: '#475467', fontSize: 10 }}>{String(emp.name || '?').slice(0, 2).toUpperCase()}</span>
                  <span style={{ flex: 1 }}>
                    <strong style={{ display: 'block' }}>{emp.name}</strong>
                    <small style={{ color: '#667085' }}>{emp.position || '—'}{otherDept ? ` · currently ${otherDept}` : ''}</small>
                  </span>
                  {checked && <span className="status active">Assigned</span>}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="mini-action" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-action"><UserPlus size={16} /> {isEdit ? 'Save department & assignments' : 'Create department & assign'}</button>
        </div>
      </form>
    </ModalCard>
  );
}

export function EmployeeReportModal({ employee, onClose, onNavigate }) {
  if (!employee) return null;
  return (
    <ModalCard title={`Employee Report: ${employee.name}`} onClose={onClose} wide>
      <div className="dashboard-grid" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        <div className="span-12" style={{ display: 'flex', gap: 16, padding: 16, background: '#f9fafb', borderRadius: 12 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#050505', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
            {String(employee.name || 'U')[0]}
          </div>
          <div>
            <h3 style={{ margin: 0 }}>{employee.name}</h3>
            <p style={{ margin: 0, color: '#667085' }}>{employee.position} · {employee.department}</p>
          </div>
        </div>
        <div className="settings-kv-grid span-12">
          <article><span>Email</span><strong>{employee.email || '—'}</strong></article>
          <article><span>Phone</span><strong>{employee.phone || '—'}</strong></article>
          <article><span>Join date</span><strong>{employee.joinDate || '—'}</strong></article>
          <article><span>Status</span><strong>{employee.status || '—'}</strong></article>
        </div>
        <button type="button" className="primary-action" onClick={onClose}>Close</button>
      </div>
    </ModalCard>
  );
}

export function SkillsMatrixModal({ employee, onClose, onSave }) {
  const [skills, setSkills] = useState(employee?.skills || [{ name: '', category: 'Technical', proficiency: 'Beginner', yearsExperience: 0, certification: '' }]);
  return (
    <ModalCard title={`Skills · ${employee?.name || ''}`} onClose={onClose} wide>
      <form className="settings-form-grid" onSubmit={e => { e.preventDefault(); onSave?.(skills); }}>
        {skills.map((s, i) => (
          <div key={i} className="modal-grid" style={{ gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8 }}>
            <input value={s.name} placeholder="Skill" onChange={e => { const n = [...skills]; n[i] = { ...n[i], name: e.target.value }; setSkills(n); }} />
            <select value={s.proficiency} onChange={e => { const n = [...skills]; n[i] = { ...n[i], proficiency: e.target.value }; setSkills(n); }}>
              {['Beginner', 'Intermediate', 'Advanced', 'Expert'].map(p => <option key={p}>{p}</option>)}
            </select>
            <input type="number" value={s.yearsExperience} onChange={e => { const n = [...skills]; n[i] = { ...n[i], yearsExperience: Number(e.target.value) }; setSkills(n); }} />
            <button type="button" onClick={() => setSkills(skills.filter((_, idx) => idx !== i))}><Trash2 size={14} /></button>
          </div>
        ))}
        <button type="button" className="mini-action" onClick={() => setSkills([...skills, { name: '', category: 'Technical', proficiency: 'Beginner', yearsExperience: 0, certification: '' }])}><Plus size={14} /> Add skill</button>
        <button type="submit" className="primary-action">Save skills</button>
      </form>
    </ModalCard>
  );
}

export function TrainingModal({ onClose, onSave, initial }) {
  const [form, setForm] = useState(initial || { title: '', provider: '', startDate: '', endDate: '', status: 'Planned' });
  return (
    <ModalCard title="Training" onClose={onClose}>
      <form className="settings-form-grid" onSubmit={e => { e.preventDefault(); onSave?.(form); }}>
        <label>Title<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></label>
        <label>Provider<input value={form.provider || ''} onChange={e => setForm({ ...form, provider: e.target.value })} /></label>
        <label>Start<input type="date" value={form.startDate || ''} onChange={e => setForm({ ...form, startDate: e.target.value })} /></label>
        <label>End<input type="date" value={form.endDate || ''} onChange={e => setForm({ ...form, endDate: e.target.value })} /></label>
        <button type="submit" className="primary-action">Save</button>
      </form>
    </ModalCard>
  );
}

export function DisciplinaryModal({ onClose, onSave }) {
  const [form, setForm] = useState({ type: 'Warning', note: '', date: new Date().toISOString().slice(0, 10) });
  return (
    <ModalCard title="Disciplinary record" onClose={onClose}>
      <form className="settings-form-grid" onSubmit={e => { e.preventDefault(); onSave?.(form); }}>
        <label>Type<select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{['Warning', 'Suspension', 'Hearing'].map(t => <option key={t}>{t}</option>)}</select></label>
        <label>Note<textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={3} /></label>
        <button type="submit" className="primary-action">Save</button>
      </form>
    </ModalCard>
  );
}

export function OnboardingModal({ onClose, onSave }) {
  const [form, setForm] = useState({ checklist: 'IT access, ID card, orientation', dueDate: '' });
  return (
    <ModalCard title="Onboarding" onClose={onClose}>
      <form className="settings-form-grid" onSubmit={e => { e.preventDefault(); onSave?.(form); }}>
        <label>Checklist<textarea value={form.checklist} onChange={e => setForm({ ...form, checklist: e.target.value })} rows={3} /></label>
        <label>Due date<input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></label>
        <button type="submit" className="primary-action">Save</button>
      </form>
    </ModalCard>
  );
}

export function ExitInterviewModal({ onClose, onSave }) {
  const [form, setForm] = useState({ reason: '', feedback: '', lastDay: '' });
  return (
    <ModalCard title="Exit interview" onClose={onClose}>
      <form className="settings-form-grid" onSubmit={e => { e.preventDefault(); onSave?.(form); }}>
        <label>Last day<input type="date" value={form.lastDay} onChange={e => setForm({ ...form, lastDay: e.target.value })} /></label>
        <label>Reason<textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={2} /></label>
        <label>Feedback<textarea value={form.feedback} onChange={e => setForm({ ...form, feedback: e.target.value })} rows={3} /></label>
        <button type="submit" className="primary-action">Save</button>
      </form>
    </ModalCard>
  );
}

export function HRCalendar({ events = [] }) {
  return (
    <div className="hr-calendar">
      {(events || []).length === 0 ? <div className="empty-state">No calendar events</div> : events.map((e, i) => (
        <div key={i} className="hr-calendar-item"><strong>{e.title}</strong><span>{e.date}</span></div>
      ))}
    </div>
  );
}

export function ShiftScheduler({ shifts = [] }) {
  return (
    <div className="shift-scheduler">
      {(shifts || []).length === 0 ? <div className="empty-state">No shifts scheduled</div> : shifts.map((s, i) => (
        <div key={i}><strong>{s.name}</strong> {s.start}–{s.end}</div>
      ))}
    </div>
  );
}

export function OrgChart({ departments = [], employees = [] }) {
  return (
    <div className="org-chart">
      {(departments || []).map(d => (
        <div key={d.id || d.name} className="org-node">
          <strong>{d.name}</strong>
          <span>{(employees || []).filter(e => e.department === d.name).length} people</span>
        </div>
      ))}
    </div>
  );
}
