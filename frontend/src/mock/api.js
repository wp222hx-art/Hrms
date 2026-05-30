/**
 * Mock API.  Mirrors the shape of a real REST API so we can later swap to
 * the backend by replacing the bodies of these functions with axios calls.
 *
 * All async to simulate latency.
 */
import { getState, setState, resetState } from './store';
import { runPayroll, calcStatutory, calcIncomeTax } from './seed';

const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms));

/* ---------------- TENANTS ---------------- */
export const tenantApi = {
  list: async () => { await delay(); return getState().tenants; },
  get:  async (id) => { await delay(); return getState().tenants.find((t) => t.id === id); },
  update: async (id, patch) => {
    await delay();
    setState((s) => ({
      ...s,
      tenants: s.tenants.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
    return getState().tenants.find((t) => t.id === id);
  },
  create: async (payload) => {
    await delay();
    const id = 'tnt-' + Math.random().toString(36).slice(2, 8);
    const tenant = {
      id,
      employeeCount: 0,
      seats: 25,
      status: 'trial',
      createdAt: new Date().toISOString().slice(0, 10),
      ...payload,
    };
    setState((s) => ({ ...s, tenants: [...s.tenants, tenant] }));
    return tenant;
  },
  remove: async (id) => {
    await delay();
    setState((s) => ({
      ...s,
      tenants: s.tenants.filter((t) => t.id !== id),
      employees: s.employees.filter((e) => e.tenantId !== id),
    }));
    return true;
  },
  reset: async () => {
    await delay(300);
    return resetState();
  },
};

/* ---------------- USERS ---------------- */
export const userApi = {
  list: async () => { await delay(); return getState().users; },
  byEmail: async (email) => {
    await delay();
    return getState().users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },
};

/* ---------------- EMPLOYEES ---------------- */
export const employeeApi = {
  list: async (tenantId, { search = '', department = '' } = {}) => {
    await delay();
    let list = getState().employees.filter((e) => e.tenantId === tenantId);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.fullName.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q),
      );
    }
    if (department) list = list.filter((e) => e.department === department);
    return list;
  },
  get: async (id) => { await delay(); return getState().employees.find((e) => e.id === id); },
  create: async (tenantId, payload) => {
    await delay();
    const emp = {
      id: `${tenantId}-emp-${Math.random().toString(36).slice(2, 8)}`,
      tenantId,
      status: 'Active',
      employmentType: 'Full-time',
      leaveBalance: { annual: 14, sick: 14, personal: 3 },
      ...payload,
    };
    setState((s) => ({ ...s, employees: [...s.employees, emp] }));
    return emp;
  },
  update: async (id, patch) => {
    await delay();
    setState((s) => ({
      ...s,
      employees: s.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
    return getState().employees.find((e) => e.id === id);
  },
  remove: async (id) => {
    await delay();
    setState((s) => ({
      ...s,
      employees: s.employees.filter((e) => e.id !== id),
    }));
    return true;
  },
};

/* ---------------- ATTENDANCE ---------------- */
export const attendanceApi = {
  list: async (tenantId, { employeeId, from, to } = {}) => {
    await delay();
    let list = getState().attendance.filter((a) => a.tenantId === tenantId);
    if (employeeId) list = list.filter((a) => a.employeeId === employeeId);
    if (from) list = list.filter((a) => a.date >= from);
    if (to)   list = list.filter((a) => a.date <= to);
    return list.sort((a, b) => (a.date < b.date ? 1 : -1));
  },
  clockIn: async (tenantId, employeeId) => {
    await delay();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    let id;
    setState((s) => {
      const existing = s.attendance.find(
        (a) => a.employeeId === employeeId && a.date === today && a.tenantId === tenantId,
      );
      if (existing) {
        id = existing.id;
        return s; // already clocked in
      }
      id = `att-${employeeId}-${today}`;
      const status = now.getHours() >= 9 && now.getMinutes() > 5 ? 'LATE' : 'PRESENT';
      return {
        ...s,
        attendance: [
          ...s.attendance,
          { id, tenantId, employeeId, date: today, checkIn: t, checkOut: null, status },
        ],
      };
    });
    return getState().attendance.find((a) => a.id === id);
  },
  clockOut: async (tenantId, employeeId) => {
    await delay();
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    setState((s) => ({
      ...s,
      attendance: s.attendance.map((a) =>
        a.tenantId === tenantId && a.employeeId === employeeId && a.date === today
          ? { ...a, checkOut: t }
          : a,
      ),
    }));
    return getState().attendance.find(
      (a) => a.tenantId === tenantId && a.employeeId === employeeId && a.date === today,
    );
  },
};

/* ---------------- LEAVE ---------------- */
export const leaveApi = {
  list: async (tenantId, { status, employeeId } = {}) => {
    await delay();
    let list = getState().leaveRequests.filter((l) => l.tenantId === tenantId);
    if (status) list = list.filter((l) => l.status === status);
    if (employeeId) list = list.filter((l) => l.employeeId === employeeId);
    return list.sort((a, b) => (a.appliedAt < b.appliedAt ? 1 : -1));
  },
  create: async (tenantId, payload) => {
    await delay();
    const req = {
      id: `lv-${Date.now()}`,
      tenantId,
      status: 'pending',
      appliedAt: new Date().toISOString(),
      ...payload,
    };
    setState((s) => ({ ...s, leaveRequests: [req, ...s.leaveRequests] }));
    return req;
  },
  decide: async (id, decision /* 'approved'|'rejected' */, approverName = 'Manager') => {
    await delay();
    setState((s) => ({
      ...s,
      leaveRequests: s.leaveRequests.map((l) =>
        l.id === id ? { ...l, status: decision, approverName, decidedAt: new Date().toISOString() } : l,
      ),
    }));
    return getState().leaveRequests.find((l) => l.id === id);
  },
};

/* ---------------- EXPENSE ---------------- */
export const expenseApi = {
  list: async (tenantId, { status, employeeId } = {}) => {
    await delay();
    let list = getState().expenseClaims.filter((e) => e.tenantId === tenantId);
    if (status) list = list.filter((e) => e.status === status);
    if (employeeId) list = list.filter((e) => e.employeeId === employeeId);
    return list.sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  },
  create: async (tenantId, payload) => {
    await delay();
    const req = {
      id: `exp-${Date.now()}`,
      tenantId,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      receiptCount: 1,
      ...payload,
    };
    setState((s) => ({ ...s, expenseClaims: [req, ...s.expenseClaims] }));
    return req;
  },
  decide: async (id, decision) => {
    await delay();
    setState((s) => ({
      ...s,
      expenseClaims: s.expenseClaims.map((e) =>
        e.id === id ? { ...e, status: decision, decidedAt: new Date().toISOString() } : e,
      ),
    }));
    return getState().expenseClaims.find((e) => e.id === id);
  },
};

/* ---------------- PAYROLL ---------------- */
export const payrollApi = {
  get: async (tenantId) => { await delay(); return getState().payrolls[tenantId]; },
  run: async (tenantId, monthLabel) => {
    await delay(400);
    const tenant = getState().tenants.find((t) => t.id === tenantId);
    const emps = getState().employees.filter((e) => e.tenantId === tenantId);
    const lines = runPayroll(emps, tenant.region, monthLabel);
    setState((s) => ({
      ...s,
      payrolls: {
        ...s.payrolls,
        [tenantId]: { month: monthLabel, generatedAt: new Date().toISOString(), lines },
      },
    }));
    return getState().payrolls[tenantId];
  },
};

/* ---------------- STATS / DASHBOARD ---------------- */
export const dashboardApi = {
  summary: async (tenantId) => {
    await delay();
    const s = getState();
    const tenant = s.tenants.find((t) => t.id === tenantId);
    const emps   = s.employees.filter((e) => e.tenantId === tenantId);
    const today  = new Date().toISOString().slice(0, 10);
    const todayAtt = s.attendance.filter((a) => a.tenantId === tenantId && a.date === today);
    const last30Att = s.attendance.filter((a) => a.tenantId === tenantId);
    // attendance trend: 7 most recent weekdays
    const trendMap = {};
    last30Att.forEach((a) => {
      trendMap[a.date] = trendMap[a.date] || { date: a.date, present: 0, absent: 0, late: 0 };
      if (a.status === 'PRESENT') trendMap[a.date].present++;
      else if (a.status === 'LATE') trendMap[a.date].late++;
      else trendMap[a.date].absent++;
    });
    const trend = Object.values(trendMap).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-10);

    const pendingLeaves   = s.leaveRequests.filter((l) => l.tenantId === tenantId && l.status === 'pending');
    const pendingExpenses = s.expenseClaims.filter((e) => e.tenantId === tenantId && (e.status === 'submitted' || e.status === 'pending'));
    const deptCount = emps.reduce((acc, e) => { acc[e.department] = (acc[e.department] || 0) + 1; return acc; }, {});

    return {
      tenant,
      employeeCount: emps.length,
      activeCount: emps.filter((e) => e.status === 'Active').length,
      todayPresent: todayAtt.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length,
      todayAbsent:  emps.length - todayAtt.length,
      trend,
      pendingLeaves: pendingLeaves.length,
      pendingExpenses: pendingExpenses.length,
      pendingLeavesList: pendingLeaves.slice(0, 5),
      pendingExpensesList: pendingExpenses.slice(0, 5),
      deptBreakdown: Object.entries(deptCount).map(([k, v]) => ({ dept: k, count: v })),
    };
  },
};

/* expose to console for demo debugging */
if (typeof window !== 'undefined') {
  window.__hrms = { getState, setState, resetState, calcStatutory, calcIncomeTax };
}
