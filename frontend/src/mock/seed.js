/**
 * Deterministic seed data factory for the Demo SaaS HRMS.
 *
 * Multi-tenant: 3 tenants representing 3 different statutory regions.
 *
 * All data is generated client-side and persisted into localStorage so the
 * demo experience survives reloads. Reset via Admin Console -> "Reset demo data".
 */

// --- Pseudo-random with seed (Mulberry32) for reproducibility ---
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickFn = (rand) => (arr) => arr[Math.floor(rand() * arr.length)];

// --- Master pools ---
const FIRST = ['Alice','Brian','Cheryl','Daniel','Elaine','Felix','Grace','Henry','Ivy','Jason','Karen','Leon','Mia','Nathan','Olivia','Patrick','Queenie','Ryan','Sophia','Trevor','Uma','Victor','Wendy','Xavier','Yvonne','Zachary'];
const LAST  = ['Tan','Lim','Lee','Wong','Ng','Chan','Goh','Teo','Koh','Chua','Ong','Yap','Sim','Loh','Toh'];
const FIRST_CN = ['伟','芳','娜','秀英','敏','静','丽','强','磊','洋','艳','勇','军','杰','涛','明','超','秀兰','霞','平','刚','桂英'];
const LAST_CN  = ['王','李','张','刘','陈','杨','黄','赵','吴','周','徐','孙','胡','朱','高','林','何','郭','马','罗'];
const FIRST_MY = ['Ahmad','Siti','Muhammad','Nurul','Ismail','Aisyah','Hafiz','Farah','Zulkifli','Nadia'];
const LAST_MY  = ['bin Ali','binti Hassan','bin Rahman','binti Ibrahim','bin Yusof','binti Ahmad'];

const DEPARTMENTS = ['Engineering','Product','Sales','Finance','Human Resources','Marketing','Operations','Customer Support'];
const POSITIONS = {
  'Engineering':       ['Software Engineer','Senior Engineer','Tech Lead','Engineering Manager','QA Engineer','DevOps Engineer'],
  'Product':           ['Product Manager','Senior PM','Product Designer','UX Researcher'],
  'Sales':             ['Account Executive','Sales Manager','BDR','Regional Sales Director'],
  'Finance':           ['Accountant','Finance Manager','Controller','Financial Analyst'],
  'Human Resources':   ['HR Specialist','HR Manager','Talent Partner','HRBP'],
  'Marketing':         ['Marketing Specialist','Content Manager','Growth Lead'],
  'Operations':        ['Operations Analyst','Operations Manager','Logistics Coordinator'],
  'Customer Support':  ['Support Specialist','Support Lead','Customer Success Manager'],
};

// --- Tenants (one per supported statutory region) ---
export const TENANTS = [
  {
    id: 'tnt-acme-sg',
    name: 'Acme Pte Ltd',
    nameZh: '艾克米私人有限公司',
    region: 'SG',
    currency: 'SGD',
    timezone: 'Asia/Singapore',
    plan: 'Professional',
    status: 'active',
    employeeCount: 28,
    seats: 50,
    createdAt: '2024-09-12',
    statutorySchema: 'sg',
    accentColor: '#3b63ec',
  },
  {
    id: 'tnt-bluesky-cn',
    name: 'BlueSky Tech',
    nameZh: '蓝海科技',
    region: 'CN',
    currency: 'CNY',
    timezone: 'Asia/Shanghai',
    plan: 'Enterprise',
    status: 'active',
    employeeCount: 36,
    seats: 100,
    createdAt: '2024-06-01',
    statutorySchema: 'cn',
    accentColor: '#10b981',
  },
  {
    id: 'tnt-megamart-my',
    name: 'Megamart Sdn Bhd',
    nameZh: '美佳超市',
    region: 'MY',
    currency: 'MYR',
    timezone: 'Asia/Kuala_Lumpur',
    plan: 'Starter',
    status: 'trial',
    employeeCount: 18,
    seats: 25,
    createdAt: '2025-11-20',
    statutorySchema: 'my',
    accentColor: '#f59e0b',
  },
  {
    id: 'tnt-nusa-id',
    name: 'PT Nusantara Digital',
    nameZh: '努桑塔拉数码',
    region: 'ID',
    currency: 'IDR',
    timezone: 'Asia/Jakarta',
    plan: 'Professional',
    status: 'active',
    employeeCount: 22,
    seats: 50,
    createdAt: '2025-03-15',
    statutorySchema: 'id',
    accentColor: '#ef4444',
  },
  {
    id: 'tnt-saigon-vn',
    name: 'Saigon Tech JSC',
    nameZh: '西贡科技',
    region: 'VN',
    currency: 'VND',
    timezone: 'Asia/Ho_Chi_Minh',
    plan: 'Professional',
    status: 'active',
    employeeCount: 20,
    seats: 50,
    createdAt: '2025-05-08',
    statutorySchema: 'vn',
    accentColor: '#facc15',
  },
  {
    id: 'tnt-bangkok-th',
    name: 'Bangkok Trade Co',
    nameZh: '曼谷贸易',
    region: 'TH',
    currency: 'THB',
    timezone: 'Asia/Bangkok',
    plan: 'Starter',
    status: 'trial',
    employeeCount: 16,
    seats: 25,
    createdAt: '2025-10-01',
    statutorySchema: 'th',
    accentColor: '#0ea5e9',
  },
  {
    id: 'tnt-manila-ph',
    name: 'Manila BPO Services',
    nameZh: '马尼拉外包服务',
    region: 'PH',
    currency: 'PHP',
    timezone: 'Asia/Manila',
    plan: 'Starter',
    status: 'active',
    employeeCount: 18,
    seats: 30,
    createdAt: '2025-08-22',
    statutorySchema: 'ph',
    accentColor: '#8b5cf6',
  },
];

const SALARY_BAND = {
  SG:  { min: 3500,  max: 14000,    currency: 'SGD' },
  CN:  { min: 8000,  max: 45000,    currency: 'CNY' },
  MY:  { min: 3000,  max: 12000,    currency: 'MYR' },
  ID:  { min: 5_000_000, max: 35_000_000, currency: 'IDR' }, // Indonesia (in IDR)
  VN:  { min: 10_000_000, max: 60_000_000, currency: 'VND' },
  TH:  { min: 18000, max: 80000,    currency: 'THB' },
  PH:  { min: 20000, max: 90000,    currency: 'PHP' },
};

const FIRST_ID = ['Budi','Siti','Andi','Dewi','Eko','Rina','Joko','Putri','Agus','Sari'];
const LAST_ID  = ['Setiawan','Wijaya','Pratama','Sari','Lestari','Hidayat','Saputra','Nugraha'];
const FIRST_VN = ['Minh','Linh','Hà','Tuấn','Phương','Quang','Trang','Hùng','Anh','Thảo'];
const LAST_VN  = ['Nguyễn','Trần','Lê','Phạm','Hoàng','Huỳnh','Vũ','Đặng'];
const FIRST_TH = ['Somchai','Suda','Niran','Pim','Anan','Wanida','Chai','Mali'];
const LAST_TH  = ['Saetang','Boonmee','Charoen','Wong','Suk','Phon'];
const FIRST_PH = ['Juan','Maria','Jose','Ana','Pedro','Luz','Andres','Liza'];
const LAST_PH  = ['Santos','Reyes','Cruz','Bautista','Mendoza','Garcia','Dela Cruz','Rivera'];

function buildEmployee(rand, tenant, idx) {
  const pick = pickFn(rand);
  let first, last;
  if (tenant.region === 'CN') {
    first = pick(FIRST_CN); last = pick(LAST_CN);
  } else if (tenant.region === 'MY' && rand() < 0.5) {
    first = pick(FIRST_MY); last = pick(LAST_MY);
  } else if (tenant.region === 'ID') {
    first = pick(FIRST_ID); last = pick(LAST_ID);
  } else if (tenant.region === 'VN') {
    first = pick(FIRST_VN); last = pick(LAST_VN);
  } else if (tenant.region === 'TH') {
    first = pick(FIRST_TH); last = pick(LAST_TH);
  } else if (tenant.region === 'PH') {
    first = pick(FIRST_PH); last = pick(LAST_PH);
  } else {
    first = pick(FIRST); last = pick(LAST);
  }
  const fullName = tenant.region === 'CN' ? `${last}${first}`
                 : tenant.region === 'VN' ? `${last} ${first}`
                 : `${first} ${last}`;
  const dept = pick(DEPARTMENTS);
  const position = pick(POSITIONS[dept]);
  const employeeId = `${tenant.region}-${String(idx + 1).padStart(4, '0')}`;
  const band = SALARY_BAND[tenant.region];
  const baseSalary = Math.round((band.min + rand() * (band.max - band.min)) / 100) * 100;
  // hire date: 0~5 yrs ago
  const daysAgo = Math.floor(rand() * 365 * 5);
  const hireDate = new Date(Date.now() - daysAgo * 86400_000).toISOString().slice(0, 10);
  // birth date 22~55 yrs ago
  const ageDays = Math.floor((22 + rand() * 33) * 365);
  const birthDate = new Date(Date.now() - ageDays * 86400_000).toISOString().slice(0, 10);
  // emails — strip Chinese & spaces
  const emailLocal = (tenant.region === 'CN' || tenant.region === 'VN' || tenant.region === 'TH')
    ? `user${idx + 1}`
    : `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '');
  const domainMap = {
    SG: 'acme.sg', CN: 'bluesky.cn', MY: 'megamart.my',
    ID: 'nusantara.id', VN: 'saigontech.vn', TH: 'bkkco.th', PH: 'manilabpo.ph',
  };
  const email = `${emailLocal}@${domainMap[tenant.region] || 'company.com'}`;

  return {
    id: `${tenant.id}-emp-${idx + 1}`,
    tenantId: tenant.id,
    employeeId,
    firstName: first,
    lastName: last,
    fullName,
    email,
    phone: tenant.region === 'SG' ? `+65 8${Math.floor(rand()*9000+1000)}${Math.floor(rand()*9000+1000)}`.slice(0,12)
         : tenant.region === 'CN' ? `+86 1${3 + Math.floor(rand()*7)}${Math.floor(rand()*900000000+100000000)}`
         : tenant.region === 'MY' ? `+60 1${Math.floor(rand()*8+1)}${Math.floor(rand()*9000000+1000000)}`
         : tenant.region === 'ID' ? `+62 8${Math.floor(rand()*900000000+100000000)}`
         : tenant.region === 'VN' ? `+84 9${Math.floor(rand()*8+1)}${Math.floor(rand()*9000000+1000000)}`
         : tenant.region === 'TH' ? `+66 8${Math.floor(rand()*9000000+1000000)}`
         : tenant.region === 'PH' ? `+63 9${Math.floor(rand()*900000000+100000000)}`
         : '',
    department: dept,
    position,
    employmentType: rand() < 0.1 ? 'Contract' : 'Full-time',
    hireDate,
    birthDate,
    status: rand() < 0.05 ? 'On Leave' : 'Active',
    managerId: null, // wired later
    baseSalary,
    currency: band.currency,
    bankAccount: `****${Math.floor(rand()*9000+1000)}`,
    nationalId: `****${Math.floor(rand()*900+100)}${tenant.region === 'SG' ? 'X' : ''}`,
    address: {
      SG: 'Singapore', CN: '上海市浦东新区张江高科技园区', MY: 'Kuala Lumpur, Malaysia',
      ID: 'Jakarta, Indonesia', VN: 'Ho Chi Minh City, Vietnam', TH: 'Bangkok, Thailand',
      PH: 'Manila, Philippines',
    }[tenant.region] || '—',
    religion: tenant.region === 'ID' ? (rand() < 0.85 ? 'Islam' : (rand() < 0.5 ? 'Kristen' : 'Hindu'))
           : tenant.region === 'MY' ? (rand() < 0.65 ? 'Islam' : (rand() < 0.5 ? 'Buddha' : 'Hindu'))
           : tenant.region === 'TH' ? 'Buddha'
           : tenant.region === 'PH' ? 'Catholic'
           : null,
    avatar: null,
    leaveBalance: {
      annual: 14 - Math.floor(rand() * 6),
      sick: 14 - Math.floor(rand() * 4),
      personal: 3 - Math.floor(rand() * 2),
    },
  };
}

function buildAttendance(rand, employees, days = 30) {
  const records = [];
  const today = new Date();
  for (const emp of employees) {
    for (let d = days; d >= 1; d--) {
      const date = new Date(today.getTime() - d * 86400_000);
      const dow = date.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends
      const isLate = rand() < 0.08;
      const isAbsent = rand() < 0.04;
      let status = 'PRESENT';
      let checkIn = '09:00';
      let checkOut = '18:00';
      if (isAbsent) {
        status = rand() < 0.5 ? 'ABSENT' : 'LEAVE';
        checkIn = null;
        checkOut = null;
      } else {
        if (isLate) {
          checkIn = `09:${String(15 + Math.floor(rand() * 30)).padStart(2,'0')}`;
          status = 'LATE';
        }
        if (rand() < 0.15) {
          // OT
          const otMin = 30 + Math.floor(rand() * 120);
          const h = 18 + Math.floor(otMin / 60);
          const m = otMin % 60;
          checkOut = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
        }
      }
      records.push({
        id: `att-${emp.id}-${d}`,
        tenantId: emp.tenantId,
        employeeId: emp.employeeId,
        date: date.toISOString().slice(0, 10),
        checkIn,
        checkOut,
        status,
      });
    }
  }
  return records;
}

const LEAVE_TYPES = ['annual','sick','personal'];
function buildLeaveRequests(rand, employees) {
  const out = [];
  const today = new Date();
  for (const emp of employees) {
    if (rand() < 0.4) continue;
    const n = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const start = new Date(today.getTime() - (rand() * 60 - 30) * 86400_000);
      const days = 1 + Math.floor(rand() * 4);
      const end = new Date(start.getTime() + (days - 1) * 86400_000);
      const type = LEAVE_TYPES[Math.floor(rand() * LEAVE_TYPES.length)];
      const r = rand();
      const status = r < 0.55 ? 'approved' : r < 0.75 ? 'pending' : r < 0.9 ? 'rejected' : 'cancelled';
      out.push({
        id: `lv-${emp.id}-${i}`,
        tenantId: emp.tenantId,
        employeeId: emp.employeeId,
        employeeName: emp.fullName,
        type,
        startDate: start.toISOString().slice(0,10),
        endDate: end.toISOString().slice(0,10),
        days,
        reason: type === 'sick' ? 'Doctor visit' : type === 'annual' ? 'Family trip' : 'Personal matters',
        status,
        appliedAt: new Date(start.getTime() - 5 * 86400_000).toISOString(),
        approverName: 'Manager A',
      });
    }
  }
  return out;
}

const EXPENSE_CATEGORIES = ['Travel','Meal','Office Supplies','Training','Software','Client Entertainment'];
function buildExpenseClaims(rand, employees) {
  const out = [];
  for (const emp of employees) {
    if (rand() < 0.5) continue;
    const n = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const cat = EXPENSE_CATEGORIES[Math.floor(rand() * EXPENSE_CATEGORIES.length)];
      const amt = Math.round((50 + rand() * 1500) * 100) / 100;
      const r = rand();
      const status = r < 0.45 ? 'paid' : r < 0.6 ? 'approved' : r < 0.8 ? 'pending' : r < 0.92 ? 'rejected' : 'submitted';
      const submittedAt = new Date(Date.now() - Math.floor(rand()*60)*86400_000).toISOString();
      out.push({
        id: `exp-${emp.id}-${i}`,
        tenantId: emp.tenantId,
        employeeId: emp.employeeId,
        employeeName: emp.fullName,
        category: cat,
        amount: amt,
        currency: emp.currency,
        description: `${cat} expense reimbursement`,
        receiptCount: 1 + Math.floor(rand() * 3),
        submittedAt,
        status,
      });
    }
  }
  return out;
}

/* --- Region-specific statutory calculators --- */
export function calcStatutory(region, gross) {
  if (region === 'SG') {
    const cpfEmployee = Math.round(gross * 0.20);  // simplified
    const cpfEmployer = Math.round(gross * 0.17);
    const sdl = Math.round(Math.min(gross, 4500) * 0.0025);
    return {
      employee: [{ key: 'cpf_employee', label: 'CPF (Employee)', amount: cpfEmployee }],
      employer: [
        { key: 'cpf_employer', label: 'CPF (Employer)', amount: cpfEmployer },
        { key: 'sdl', label: 'SDL', amount: sdl },
      ],
    };
  }
  if (region === 'CN') {
    // 五险一金 simplified employee side
    const pension = Math.round(gross * 0.08);
    const medical = Math.round(gross * 0.02);
    const unemployment = Math.round(gross * 0.005);
    const housing = Math.round(gross * 0.07);
    return {
      employee: [
        { key: 'pension', label: '养老保险', amount: pension },
        { key: 'medical', label: '医疗保险', amount: medical },
        { key: 'unemployment', label: '失业保险', amount: unemployment },
        { key: 'housing_fund', label: '住房公积金', amount: housing },
      ],
      employer: [
        { key: 'pension_er', label: '养老保险(企业)', amount: Math.round(gross * 0.16) },
        { key: 'medical_er', label: '医疗保险(企业)', amount: Math.round(gross * 0.08) },
        { key: 'work_injury', label: '工伤保险', amount: Math.round(gross * 0.005) },
        { key: 'maternity', label: '生育保险', amount: Math.round(gross * 0.008) },
        { key: 'housing_fund_er', label: '住房公积金(企业)', amount: Math.round(gross * 0.07) },
      ],
    };
  }
  if (region === 'MY') {
    const epfEmployee = Math.round(gross * 0.11);
    const epfEmployer = Math.round(gross * 0.13);
    const socso = Math.round(Math.min(gross, 5000) * 0.005);
    const eis = Math.round(Math.min(gross, 5000) * 0.002);
    return {
      employee: [
        { key: 'epf_employee', label: 'EPF (Employee)', amount: epfEmployee },
        { key: 'socso_employee', label: 'SOCSO (Employee)', amount: socso },
        { key: 'eis_employee', label: 'EIS (Employee)', amount: eis },
      ],
      employer: [
        { key: 'epf_employer', label: 'EPF (Employer)', amount: epfEmployer },
        { key: 'socso_employer', label: 'SOCSO (Employer)', amount: socso },
        { key: 'eis_employer', label: 'EIS (Employer)', amount: eis },
      ],
    };
  }
  return { employee: [], employer: [] };
}

/* Income tax — very simplified progressive brackets */
export function calcIncomeTax(region, annualTaxable) {
  if (region === 'SG') {
    // Simplified IRAS 2025 progressive (resident)
    const brackets = [
      [20000, 0], [30000, 0.02], [40000, 0.035], [80000, 0.07],
      [120000, 0.115], [160000, 0.15], [200000, 0.18], [240000, 0.19],
      [280000, 0.195], [320000, 0.20], [Infinity, 0.22],
    ];
    return progressive(annualTaxable, brackets);
  }
  if (region === 'CN') {
    const brackets = [
      [36000, 0.03], [144000, 0.10], [300000, 0.20], [420000, 0.25],
      [660000, 0.30], [960000, 0.35], [Infinity, 0.45],
    ];
    return progressive(annualTaxable, brackets);
  }
  if (region === 'MY') {
    const brackets = [
      [5000, 0], [20000, 0.01], [35000, 0.03], [50000, 0.08],
      [70000, 0.13], [100000, 0.21], [400000, 0.24], [Infinity, 0.30],
    ];
    return progressive(annualTaxable, brackets);
  }
  return 0;
}
function progressive(amount, brackets) {
  let prev = 0, tax = 0;
  for (const [cap, rate] of brackets) {
    if (amount <= cap) { tax += (amount - prev) * rate; return Math.max(0, Math.round(tax)); }
    tax += (cap - prev) * rate;
    prev = cap;
  }
  return Math.round(tax);
}

/* --- Master payroll runner --- */
export function runPayroll(employees, region, monthLabel) {
  return employees.map((emp) => {
    const gross = emp.baseSalary;
    const stat = calcStatutory(region, gross);
    const empDeductions = stat.employee.reduce((s, x) => s + x.amount, 0);
    const annualTax = calcIncomeTax(region, gross * 12 - empDeductions * 12);
    const monthlyTax = Math.round(annualTax / 12);
    const net = gross - empDeductions - monthlyTax;
    return {
      employeeId: emp.employeeId,
      employeeName: emp.fullName,
      department: emp.department,
      gross,
      employeeStatutory: stat.employee,
      employerStatutory: stat.employer,
      tax: monthlyTax,
      net,
      currency: emp.currency,
      month: monthLabel,
    };
  });
}

/* --- Main builder --- */
export function buildSeed() {
  const allEmployees = [];
  for (const tenant of TENANTS) {
    const rand = rng(parseInt(tenant.id.replace(/\D/g, '0'), 10) || 1);
    const list = [];
    for (let i = 0; i < tenant.employeeCount; i++) {
      list.push(buildEmployee(rand, tenant, i));
    }
    // wire managers — first 4 in each dept become managers
    const byDept = {};
    list.forEach((e) => { byDept[e.department] = byDept[e.department] || []; byDept[e.department].push(e); });
    Object.values(byDept).forEach((arr) => {
      const mgr = arr[0];
      arr.slice(1).forEach((e) => { e.managerId = mgr.id; });
    });
    allEmployees.push(...list);
  }

  const allAttendance = buildAttendance(rng(7), allEmployees, 30);
  const allLeave     = buildLeaveRequests(rng(11), allEmployees);
  const allExpenses  = buildExpenseClaims(rng(13), allEmployees);

  // generate latest payroll run per tenant
  const payrolls = {};
  const lastMonth = new Date();
  lastMonth.setDate(1);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const monthLabel = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

  for (const t of TENANTS) {
    const emps = allEmployees.filter((e) => e.tenantId === t.id);
    payrolls[t.id] = {
      month: monthLabel,
      generatedAt: new Date().toISOString(),
      lines: runPayroll(emps, t.region, monthLabel),
    };
  }

  return {
    tenants: TENANTS,
    employees: allEmployees,
    attendance: allAttendance,
    leaveRequests: allLeave,
    expenseClaims: allExpenses,
    payrolls,
    users: [
      { id: 'su-1', email: 'admin@hrms.io',     name: 'Super Admin',  role: 'super_admin', tenantId: null },
      { id: 'hr-1', email: 'hr@acme.sg',        name: 'Sarah HR',     role: 'hr_admin',    tenantId: 'tnt-acme-sg' },
      { id: 'mg-1', email: 'manager@acme.sg',   name: 'Mike Manager', role: 'manager',     tenantId: 'tnt-acme-sg' },
      { id: 'em-1', email: 'employee@acme.sg',  name: 'Eric Employee',role: 'employee',    tenantId: 'tnt-acme-sg' },
      { id: 'hr-2', email: 'hr@bluesky.cn',     name: '王小华',        role: 'hr_admin',    tenantId: 'tnt-bluesky-cn' },
      { id: 'em-2', email: 'employee@bluesky.cn', name: '李小明',      role: 'employee',    tenantId: 'tnt-bluesky-cn' },
      { id: 'hr-3', email: 'hr@nusantara.id',   name: 'Dewi Setiawan',role: 'hr_admin',    tenantId: 'tnt-nusa-id' },
      { id: 'hr-4', email: 'hr@saigontech.vn',  name: 'Trần Minh',    role: 'hr_admin',    tenantId: 'tnt-saigon-vn' },
      { id: 'hr-5', email: 'hr@bkkco.th',       name: 'Somchai Wong', role: 'hr_admin',    tenantId: 'tnt-bangkok-th' },
      { id: 'hr-6', email: 'hr@manilabpo.ph',   name: 'Maria Santos', role: 'hr_admin',    tenantId: 'tnt-manila-ph' },
    ],
  };
}
