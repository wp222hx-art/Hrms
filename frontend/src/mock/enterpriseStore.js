/**
 * Enterprise Platform Store
 *
 * Single localStorage-backed data layer for the "正规版" enterprise features:
 *   - Departments (tree structure with managers + HRBPs)
 *   - Positions / Job grades
 *   - Approval workflows (templates + instances)
 *   - IM (conversations + messages + bots)
 *   - Announcements & Notifications
 *   - Workspace pinned apps
 *   - SEA-specific statutory schemas (ID / VN / TH / PH)
 *
 * Storage key: `hrms_enterprise_v2`. Per-tenant bucket.
 * All write functions are synchronous; thin async API wrappers live in api.js.
 */

const KEY = 'hrms_enterprise_v2'; // bumped from v1: localized handbook per country + region-specific training
const NOW = () => new Date().toISOString();

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
  catch { return {}; }
}
function save(d) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* quota */ }
}

function emptyBucket() {
  return {
    departments: [],         // tree (parentId)
    positions: [],           // job grades
    workflowTemplates: [],   // approval flow definitions
    workflowInstances: [],   // ongoing/completed approvals
    conversations: [],       // IM threads
    messages: {},            // { conversationId: [msg] }
    contactsPinned: {},      // { employeeId: [contactEmpId] }
    announcements: [],
    notifications: [],       // { employeeId, ... }
    workspaceLayouts: {},    // { employeeId: { pinned: [appKey] } }
    holidays: [],            // public + religious holidays
    handbookCategories: [],  // [{id, name, icon, sort}]
    handbookArticles: [],    // [{id, categoryId, title, summary, body, tags, updatedAt, readers, mustRead}]
    courses: [],             // [{id, title, ..., lessons:[]}]
    enrollments: [],         // [{id, employeeId, courseId, status, completedLessonIds, score, ...}]
    certificates: [],        // [{id, employeeId, courseId, score, issuedAt, code}]
    initialized: false,
  };
}

export function bucket(tenantId) {
  const all = load();
  if (!all[tenantId]) { all[tenantId] = emptyBucket(); save(all); }
  // backfill missing keys for legacy
  const b = all[tenantId];
  Object.entries(emptyBucket()).forEach(([k, v]) => {
    if (b[k] === undefined) b[k] = v;
  });
  save(all);
  return b;
}
export function update(tenantId, mutator) {
  const all = load();
  if (!all[tenantId]) all[tenantId] = emptyBucket();
  mutator(all[tenantId]);
  save(all);
  return all[tenantId];
}

/* ============================================================
 *  SEEDING — One-time per tenant
 * ============================================================ */
export function seedTenant(tenantId, employees, tenantRegion = 'SG') {
  const b = bucket(tenantId);
  if (b.initialized) return b;

  update(tenantId, (bk) => {
    bk.departments = buildDepartmentTree(employees, tenantRegion);
    bk.positions   = buildPositions(tenantRegion);
    bk.workflowTemplates = buildWorkflowTemplates();
    bk.holidays    = buildHolidays(tenantRegion);
    bk.announcements = buildSeedAnnouncements(tenantRegion);
    bk.conversations = buildSeedConversations(tenantId, employees);
    bk.messages    = buildSeedMessages(bk.conversations, employees);
    bk.handbookCategories = buildHandbookCategories(tenantRegion);
    bk.handbookArticles   = buildHandbookArticles(tenantRegion);
    bk.courses     = buildCourses(tenantRegion);
    bk.initialized = true;
  });
  return bucket(tenantId);
}

/* ============================================================
 *  DEPARTMENTS
 * ============================================================ */
function buildDepartmentTree(employees, region) {
  const root = { id: 'd-root', parentId: null, name: '集团 / Group', nameEn: 'Group', code: 'GRP', sort: 0 };
  const deptNames = Array.from(new Set(employees.map((e) => e.department)));
  const subs = deptNames.map((nm, idx) => {
    const codeMap = {
      'Engineering':'ENG','Product':'PRD','Sales':'SLS','Finance':'FIN',
      'Human Resources':'HR','Marketing':'MKT','Operations':'OPS','Customer Support':'CS',
    };
    const code = codeMap[nm] || nm.slice(0, 3).toUpperCase();
    const managerEmp = employees.find((e) => e.department === nm) || null;
    return {
      id: `d-${code.toLowerCase()}`,
      parentId: 'd-root',
      name: nm,
      nameEn: nm,
      code,
      managerId: managerEmp ? managerEmp.id : null,
      hrbpId: null,
      headcount: employees.filter((e) => e.department === nm).length,
      sort: idx + 1,
      region,
    };
  });
  return [root, ...subs];
}
export function listDepartments(tenantId) { return bucket(tenantId).departments; }
export function deptTree(tenantId) {
  const list = listDepartments(tenantId);
  const map = new Map(list.map((d) => [d.id, { ...d, children: [] }]));
  const roots = [];
  map.forEach((d) => {
    if (d.parentId && map.has(d.parentId)) map.get(d.parentId).children.push(d);
    else roots.push(d);
  });
  return roots;
}
export function createDept(tenantId, payload) {
  const dept = {
    id: `d-${Math.random().toString(36).slice(2, 7)}`,
    parentId: 'd-root', name: '新部门', code: 'NEW',
    managerId: null, hrbpId: null, headcount: 0, sort: 999,
    ...payload,
  };
  update(tenantId, (b) => { b.departments.push(dept); });
  return dept;
}
export function updateDept(tenantId, id, patch) {
  update(tenantId, (b) => {
    b.departments = b.departments.map((d) => (d.id === id ? { ...d, ...patch } : d));
  });
}
export function deleteDept(tenantId, id) {
  update(tenantId, (b) => {
    // re-parent children to root
    b.departments = b.departments
      .map((d) => (d.parentId === id ? { ...d, parentId: 'd-root' } : d))
      .filter((d) => d.id !== id);
  });
}
export function moveEmployeeToDept(tenantId, employeeId, deptId) {
  // marks transfer; actual employee.department is updated in api.js
  update(tenantId, (b) => {
    if (!b.transfers) b.transfers = [];
    b.transfers.push({
      id: `tr-${Date.now()}`, employeeId, deptId, at: NOW(),
    });
  });
}

/* ============================================================
 *  POSITIONS / JOB GRADES
 * ============================================================ */
function buildPositions(region) {
  // P/M dual-ladder common in SEA tech firms
  const grades = ['P1','P2','P3','P4','P5','P6','M1','M2','M3','M4'];
  return grades.map((g, idx) => ({
    id: `pos-${g.toLowerCase()}`,
    grade: g,
    track: g.startsWith('M') ? 'Management' : 'Professional',
    name: g.startsWith('M') ? `${g} 管理岗` : `${g} 专业岗`,
    minSalary: 3000 + idx * 2000,
    maxSalary: 6000 + idx * 4500,
    region,
    sort: idx,
  }));
}
export function listPositions(tenantId) { return bucket(tenantId).positions; }

/* ============================================================
 *  WORKFLOW ENGINE
 * ============================================================ */
function buildWorkflowTemplates() {
  return [
    {
      id: 'wf-leave',
      name: '请假申请',
      nameEn: 'Leave Request',
      icon: '🌴',
      category: 'HR',
      conditions: [
        { if: 'days <= 2', steps: ['direct_manager'] },
        { if: 'days <= 5', steps: ['direct_manager', 'dept_manager'] },
        { if: 'true',      steps: ['direct_manager', 'dept_manager', 'hr_admin'] },
      ],
      fields: [
        { key:'type',      label:'请假类型', kind:'select', options:['annual','sick','personal','marriage','maternity','paternity','bereavement'] },
        { key:'startDate', label:'开始日期', kind:'date' },
        { key:'endDate',   label:'结束日期', kind:'date' },
        { key:'days',      label:'天数',     kind:'number' },
        { key:'reason',    label:'事由',     kind:'textarea' },
        { key:'attach',    label:'附件',     kind:'file' },
      ],
    },
    {
      id: 'wf-expense',
      name: '费用报销',
      nameEn: 'Expense Claim',
      icon: '💰',
      category: 'Finance',
      conditions: [
        { if: 'amount <= 500',    steps: ['direct_manager'] },
        { if: 'amount <= 5000',   steps: ['direct_manager', 'finance'] },
        { if: 'true',             steps: ['direct_manager', 'finance', 'ceo'] },
      ],
      fields: [
        { key:'category', label:'类别',     kind:'select', options:['Travel','Meal','Office','Software','Entertainment','Other'] },
        { key:'amount',   label:'金额',     kind:'number' },
        { key:'currency', label:'币种',     kind:'select', options:['SGD','MYR','IDR','VND','THB','PHP','CNY','USD'] },
        { key:'reason',   label:'说明',     kind:'textarea' },
        { key:'receipt',  label:'发票/凭证', kind:'file' },
      ],
    },
    {
      id: 'wf-overtime',
      name: '加班申请',
      nameEn: 'Overtime',
      icon: '🌙',
      category: 'Attendance',
      conditions: [{ if: 'true', steps: ['direct_manager', 'dept_manager'] }],
      fields: [
        { key:'date',     label:'加班日期', kind:'date' },
        { key:'hours',    label:'时长(小时)', kind:'number' },
        { key:'reason',   label:'原因',     kind:'textarea' },
      ],
    },
    {
      id: 'wf-business-trip',
      name: '出差申请',
      nameEn: 'Business Trip',
      icon: '✈️',
      category: 'Travel',
      conditions: [
        { if: 'budget <= 2000', steps: ['direct_manager'] },
        { if: 'true',           steps: ['direct_manager', 'dept_manager', 'finance'] },
      ],
      fields: [
        { key:'destination', label:'目的地',  kind:'text' },
        { key:'startDate',   label:'出发日期', kind:'date' },
        { key:'endDate',     label:'返回日期', kind:'date' },
        { key:'purpose',     label:'目的',    kind:'textarea' },
        { key:'budget',      label:'预算',    kind:'number' },
      ],
    },
    {
      id: 'wf-resign',
      name: '离职申请',
      nameEn: 'Resignation',
      icon: '👋',
      category: 'HR',
      conditions: [{ if: 'true', steps: ['direct_manager', 'dept_manager', 'hr_admin', 'ceo'] }],
      fields: [
        { key:'lastDay',  label:'最后工作日', kind:'date' },
        { key:'reason',   label:'离职原因',   kind:'textarea' },
        { key:'handover', label:'交接计划',   kind:'textarea' },
      ],
    },
    {
      id: 'wf-purchase',
      name: '采购申请',
      nameEn: 'Purchase Request',
      icon: '🛒',
      category: 'Finance',
      conditions: [
        { if: 'amount <= 1000',  steps: ['direct_manager'] },
        { if: 'amount <= 10000', steps: ['direct_manager', 'finance'] },
        { if: 'true',            steps: ['direct_manager', 'finance', 'ceo'] },
      ],
      fields: [
        { key:'item',     label:'物品名称', kind:'text' },
        { key:'qty',      label:'数量',     kind:'number' },
        { key:'amount',   label:'总价',     kind:'number' },
        { key:'currency', label:'币种',     kind:'select', options:['SGD','MYR','IDR','VND','THB','PHP','CNY'] },
        { key:'reason',   label:'用途',     kind:'textarea' },
      ],
    },
    {
      id: 'wf-cert',
      name: '证明开具',
      nameEn: 'Certificate Request',
      icon: '📜',
      category: 'HR',
      conditions: [{ if: 'true', steps: ['hr_admin'] }],
      fields: [
        { key:'certType', label:'证明类型', kind:'select', options:['在职证明','收入证明','离职证明','出差证明'] },
        { key:'lang',     label:'语言',     kind:'select', options:['中文','English','Bahasa','Tiếng Việt'] },
        { key:'purpose',  label:'用途',     kind:'text' },
      ],
    },
    {
      id: 'wf-transfer',
      name: '内部调动',
      nameEn: 'Internal Transfer',
      icon: '🔄',
      category: 'HR',
      conditions: [{ if: 'true', steps: ['direct_manager','target_manager','hr_admin'] }],
      fields: [
        { key:'targetDept', label:'目标部门', kind:'text' },
        { key:'targetPos',  label:'目标岗位', kind:'text' },
        { key:'effective',  label:'生效日期', kind:'date' },
        { key:'reason',     label:'调动原因', kind:'textarea' },
      ],
    },
  ];
}
export function listWorkflowTemplates(tenantId) {
  return bucket(tenantId).workflowTemplates;
}
export function workflowTemplate(tenantId, id) {
  return bucket(tenantId).workflowTemplates.find((w) => w.id === id);
}

/** Evaluate condition string against a payload */
function evalCond(cond, payload) {
  if (cond === 'true') return true;
  // very simple expressions: <var> <op> <num>
  const m = cond.match(/^(\w+)\s*(<=|>=|<|>|==)\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return false;
  const [, key, op, n] = m;
  const v = Number(payload[key] ?? 0);
  const num = Number(n);
  switch (op) {
    case '<=': return v <= num;
    case '>=': return v >= num;
    case '<':  return v <  num;
    case '>':  return v >  num;
    case '==': return v === num;
    default:   return false;
  }
}

const STEP_LABEL = {
  direct_manager: '直属主管',
  dept_manager:   '部门负责人',
  hr_admin:       'HR 负责人',
  finance:        '财务',
  ceo:            'CEO',
  target_manager: '目标部门主管',
};

/** Resolve which steps fire for this payload */
export function resolveSteps(template, payload) {
  for (const c of template.conditions || []) {
    if (evalCond(c.if, payload)) {
      return c.steps.map((s) => ({ role: s, label: STEP_LABEL[s] || s }));
    }
  }
  return [];
}

export function submitWorkflow(tenantId, { templateId, applicant, payload }) {
  const tpl = workflowTemplate(tenantId, templateId);
  if (!tpl) return null;
  const steps = resolveSteps(tpl, payload).map((s, idx) => ({
    ...s, status: idx === 0 ? 'pending' : 'waiting', actorName: null, decidedAt: null, comment: '',
  }));
  const inst = {
    id: `wfi-${Date.now()}`,
    tenantId,
    templateId,
    templateName: tpl.name,
    icon: tpl.icon,
    applicantId: applicant.id,
    applicantName: applicant.fullName,
    department: applicant.department,
    payload,
    steps,
    status: steps.length ? 'pending' : 'approved',
    submittedAt: NOW(),
    decidedAt: null,
  };
  update(tenantId, (b) => { b.workflowInstances.unshift(inst); });
  return inst;
}

export function listWorkflowInstances(tenantId, filter = {}) {
  let list = bucket(tenantId).workflowInstances;
  if (filter.applicantId) list = list.filter((x) => x.applicantId === filter.applicantId);
  if (filter.status)      list = list.filter((x) => x.status === filter.status);
  if (filter.templateId)  list = list.filter((x) => x.templateId === filter.templateId);
  return list;
}

export function decideWorkflowStep(tenantId, instanceId, decision, { actor, comment = '' } = {}) {
  update(tenantId, (b) => {
    const inst = b.workflowInstances.find((x) => x.id === instanceId);
    if (!inst) return;
    const stepIdx = inst.steps.findIndex((s) => s.status === 'pending');
    if (stepIdx < 0) return;
    const step = inst.steps[stepIdx];
    step.status = decision; // 'approved' | 'rejected'
    step.actorName = actor || 'Unknown';
    step.decidedAt = NOW();
    step.comment = comment;

    if (decision === 'rejected') {
      inst.status = 'rejected';
      inst.decidedAt = NOW();
      for (let i = stepIdx + 1; i < inst.steps.length; i++) inst.steps[i].status = 'skipped';
    } else {
      const next = inst.steps[stepIdx + 1];
      if (next) {
        next.status = 'pending';
      } else {
        inst.status = 'approved';
        inst.decidedAt = NOW();
      }
    }
  });
}

export function withdrawWorkflow(tenantId, instanceId) {
  update(tenantId, (b) => {
    const inst = b.workflowInstances.find((x) => x.id === instanceId);
    if (!inst || inst.status !== 'pending') return;
    inst.status = 'withdrawn';
    inst.decidedAt = NOW();
    inst.steps.forEach((s) => { if (s.status === 'pending' || s.status === 'waiting') s.status = 'skipped'; });
  });
}

/* ============================================================
 *  IM SYSTEM
 * ============================================================ */
function buildSeedConversations(tenantId, employees) {
  const out = [];
  if (employees.length === 0) return out;
  // 1 system bot
  out.push({
    id: `cv-${tenantId}-bot-hr`,
    tenantId,
    type: 'bot',
    name: 'HR 助手',
    nameEn: 'HR Bot',
    avatar: '🤖',
    memberIds: ['bot-hr', ...employees.map((e) => e.id)],
    botKey: 'hr',
    lastMessage: '你好！我可以帮你查询请假余额、报销规则、政策问题',
    lastAt: NOW(),
    unread: { 'bot-hr': 0 },
    pinned: true,
  });
  out.push({
    id: `cv-${tenantId}-bot-approval`,
    tenantId,
    type: 'bot',
    name: '审批通知',
    nameEn: 'Approval Bot',
    avatar: '✅',
    memberIds: ['bot-approval', ...employees.map((e) => e.id)],
    botKey: 'approval',
    lastMessage: '所有审批通知会在这里推送',
    lastAt: NOW(),
    unread: {},
    pinned: true,
  });
  // Sample dept group
  const deptNames = Array.from(new Set(employees.map((e) => e.department)));
  deptNames.slice(0, 3).forEach((d) => {
    const members = employees.filter((e) => e.department === d).slice(0, 8);
    if (members.length < 2) return;
    out.push({
      id: `cv-${tenantId}-grp-${d.toLowerCase().replace(/\s+/g, '-')}`,
      tenantId,
      type: 'group',
      name: `${d} · 部门群`,
      nameEn: `${d} Group`,
      avatar: '👥',
      memberIds: members.map((m) => m.id),
      lastMessage: '大家辛苦了，本周目标已完成 80%',
      lastAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      unread: {},
      pinned: false,
    });
  });
  // A few 1:1 between random pairs
  if (employees.length >= 4) {
    for (let i = 0; i < 4; i++) {
      const a = employees[i];
      const b = employees[(i + 1) % employees.length];
      if (a.id === b.id) continue;
      out.push({
        id: `cv-${tenantId}-dm-${a.id}-${b.id}`,
        tenantId,
        type: 'dm',
        name: null,
        memberIds: [a.id, b.id],
        lastMessage: i % 2 === 0 ? '收到，我下午对接一下' : 'OK 👍',
        lastAt: new Date(Date.now() - (i + 1) * 7200 * 1000).toISOString(),
        unread: {},
        pinned: false,
      });
    }
  }
  return out;
}

function buildSeedMessages(conversations, employees) {
  const m = {};
  conversations.forEach((cv) => {
    m[cv.id] = [];
    if (cv.type === 'bot' && cv.botKey === 'hr') {
      m[cv.id].push({
        id: `msg-${cv.id}-1`, conversationId: cv.id,
        senderId: 'bot-hr', senderName: 'HR Bot',
        text: '👋 你好！我是 HR 助手，常见问题：\n· 请假余额\n· 报销规则\n· 公司政策\n· 入职手续',
        at: new Date(Date.now() - 86400_000).toISOString(),
        kind: 'text',
      });
    }
    if (cv.type === 'bot' && cv.botKey === 'approval') {
      m[cv.id].push({
        id: `msg-${cv.id}-1`, conversationId: cv.id,
        senderId: 'bot-approval', senderName: 'Approval Bot',
        text: '✅ 审批通知中心已启用',
        at: new Date(Date.now() - 86400_000).toISOString(),
        kind: 'text',
      });
    }
    if (cv.type === 'group' && cv.memberIds.length >= 2) {
      const samples = ['早上好☀️', '本周目标我们要拿下！', '辛苦了，下班吃饭去？', '会议改到下午 3 点哦', '收到 ✅'];
      for (let i = 0; i < 5; i++) {
        const sender = employees.find((e) => e.id === cv.memberIds[i % cv.memberIds.length]);
        if (!sender) continue;
        m[cv.id].push({
          id: `msg-${cv.id}-${i}`, conversationId: cv.id,
          senderId: sender.id, senderName: sender.fullName,
          text: samples[i],
          at: new Date(Date.now() - (5 - i) * 60_000).toISOString(),
          kind: 'text',
        });
      }
    }
    if (cv.type === 'dm') {
      const a = employees.find((e) => e.id === cv.memberIds[0]);
      const b = employees.find((e) => e.id === cv.memberIds[1]);
      if (a && b) {
        m[cv.id].push({
          id: `msg-${cv.id}-1`, conversationId: cv.id,
          senderId: a.id, senderName: a.fullName,
          text: 'Hi，今天午餐？',
          at: new Date(Date.now() - 7200_000).toISOString(),
          kind: 'text',
        });
        m[cv.id].push({
          id: `msg-${cv.id}-2`, conversationId: cv.id,
          senderId: b.id, senderName: b.fullName,
          text: 'OK 12 点楼下见 👋',
          at: new Date(Date.now() - 7000_000).toISOString(),
          kind: 'text',
        });
      }
    }
  });
  return m;
}

export function listConversations(tenantId, employeeId) {
  const b = bucket(tenantId);
  return b.conversations
    .filter((c) => c.memberIds.includes(employeeId))
    .sort((x, y) => {
      if (x.pinned !== y.pinned) return x.pinned ? -1 : 1;
      return new Date(y.lastAt) - new Date(x.lastAt);
    });
}

export function conversationMessages(tenantId, conversationId) {
  return bucket(tenantId).messages[conversationId] || [];
}

export function sendMessage(tenantId, conversationId, msg) {
  const m = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    conversationId,
    at: NOW(),
    kind: 'text',
    ...msg,
  };
  update(tenantId, (b) => {
    if (!b.messages[conversationId]) b.messages[conversationId] = [];
    b.messages[conversationId].push(m);
    const cv = b.conversations.find((c) => c.id === conversationId);
    if (cv) {
      cv.lastMessage = m.text || `[${m.kind}]`;
      cv.lastAt = m.at;
    }
  });
  // bot auto-reply
  const cv = bucket(tenantId).conversations.find((c) => c.id === conversationId);
  if (cv && cv.type === 'bot') {
    setTimeout(() => botReply(tenantId, conversationId, cv.botKey, msg.text), 600);
  }
  return m;
}

function botReply(tenantId, conversationId, botKey, userText) {
  let reply = '我已记录，会尽快回复你。';
  const txt = (userText || '').toLowerCase();
  if (botKey === 'hr') {
    if (/请假|leave|休假/.test(txt))      reply = '🌴 请假规则：年假按工龄递增（1-3年 14天 / 3-5年 16天 / 5年+ 21天）。要提交请假申请，请到「流程中心 → 请假」。';
    else if (/报销|expense|reimburs/.test(txt)) reply = '💰 报销规则：100以下当日审批，1000以上需总监审批。请准备发票/凭证，到「流程中心 → 费用报销」提交。';
    else if (/工资|薪|payroll|salary/.test(txt)) reply = '💼 工资条每月 25 日发放，可在「我的-工资单」查看明细。';
    else if (/加班|overtime|ot/.test(txt)) reply = '🌙 加班需提前在「流程中心 → 加班申请」报备，主管批准后计入加班时长。';
    else if (/政策|policy|手册/.test(txt))  reply = '📚 完整员工手册见「学习中心 / Academy」，新员工 7 日内需完成入职考试。';
    else if (/你好|hi|hello/.test(txt))     reply = '👋 你好！我是 HR 助手，告诉我你想了解什么吧（请假、报销、薪资、加班、政策…）';
    else reply = '🤔 我可以帮你查询：请假规则、报销流程、薪资发放、加班政策、员工手册。请说得更具体些～';
  }
  if (botKey === 'approval') {
    reply = '✅ 审批通知中心已收到。请到「流程中心」查看详情。';
  }
  update(tenantId, (b) => {
    if (!b.messages[conversationId]) b.messages[conversationId] = [];
    const m = {
      id: `msg-${Date.now()}-bot`, conversationId,
      senderId: `bot-${botKey}`, senderName: botKey === 'hr' ? 'HR Bot' : 'Approval Bot',
      text: reply, at: NOW(), kind: 'text',
    };
    b.messages[conversationId].push(m);
    const cv = b.conversations.find((c) => c.id === conversationId);
    if (cv) { cv.lastMessage = reply; cv.lastAt = m.at; }
  });
}

export function createGroupChat(tenantId, { name, creatorId, memberIds }) {
  const cv = {
    id: `cv-${Date.now()}`,
    tenantId,
    type: memberIds.length === 2 ? 'dm' : 'group',
    name: memberIds.length === 2 ? null : (name || '新群组'),
    avatar: memberIds.length === 2 ? null : '👥',
    memberIds,
    creatorId,
    lastMessage: '群组已创建',
    lastAt: NOW(),
    unread: {},
    pinned: false,
  };
  update(tenantId, (b) => {
    b.conversations.unshift(cv);
    b.messages[cv.id] = [{
      id: `msg-${cv.id}-create`,
      conversationId: cv.id,
      senderId: 'system',
      senderName: 'System',
      text: `群组已创建 · ${memberIds.length} 位成员`,
      at: NOW(),
      kind: 'system',
    }];
  });
  return cv;
}

export function findOrCreateDM(tenantId, employeeAId, employeeBId) {
  if (employeeAId === employeeBId) return null;
  const b = bucket(tenantId);
  const existing = b.conversations.find(
    (c) => c.type === 'dm'
      && c.memberIds.length === 2
      && c.memberIds.includes(employeeAId)
      && c.memberIds.includes(employeeBId),
  );
  if (existing) return existing;
  return createGroupChat(tenantId, { creatorId: employeeAId, memberIds: [employeeAId, employeeBId] });
}

/* ============================================================
 *  ANNOUNCEMENTS
 * ============================================================ */
function buildSeedAnnouncements(region) {
  const today = new Date();
  return [
    {
      id: 'ann-welcome',
      title: '🎉 欢迎使用全新企业平台',
      body: '我们升级了组织架构、流程中心、即时通讯、知识中心四大模块。请前往「工作台」体验。',
      level: 'info',
      pinned: true,
      authorName: '系统管理员',
      publishedAt: new Date(today.getTime() - 86400_000).toISOString(),
      readers: [],
    },
    {
      id: 'ann-holiday',
      title: '📅 节假日安排',
      body: region === 'SG'
        ? 'Public Holidays (SG): Hari Raya Puasa, Vesak Day, Hari Raya Haji, National Day, Deepavali, Christmas.'
        : region === 'MY'
          ? 'Cuti Umum (MY): Hari Raya Aidilfitri, Wesak, Hari Raya Aidiladha, Hari Merdeka, Deepavali, Krismas.'
          : '法定节假日安排请见附件，节日福利将在节前 3 天发放。',
      level: 'success',
      pinned: false,
      authorName: 'HR',
      publishedAt: new Date(today.getTime() - 2 * 86400_000).toISOString(),
      readers: [],
    },
    {
      id: 'ann-safety',
      title: '🛡️ 信息安全提醒',
      body: '近期出现钓鱼邮件攻击，请大家注意：不点击未知链接、不下载未知附件、可疑邮件请转发至 security@。',
      level: 'warning',
      pinned: false,
      authorName: '安全团队',
      publishedAt: new Date(today.getTime() - 5 * 86400_000).toISOString(),
      readers: [],
    },
  ];
}
export function listAnnouncements(tenantId) {
  return bucket(tenantId).announcements.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.publishedAt) - new Date(a.publishedAt);
  });
}
export function publishAnnouncement(tenantId, payload) {
  const a = {
    id: `ann-${Date.now()}`,
    title: '', body: '', level: 'info',
    pinned: false, authorName: 'HR',
    publishedAt: NOW(), readers: [],
    ...payload,
  };
  update(tenantId, (b) => { b.announcements.unshift(a); });
  return a;
}
export function markAnnouncementRead(tenantId, annId, employeeId) {
  update(tenantId, (b) => {
    const a = b.announcements.find((x) => x.id === annId);
    if (a && !a.readers.includes(employeeId)) a.readers.push(employeeId);
  });
}

/* ============================================================
 *  NOTIFICATIONS
 * ============================================================ */
export function pushNotification(tenantId, { employeeId, kind, title, body, link }) {
  const n = {
    id: `nt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    tenantId, employeeId,
    kind: kind || 'info',     // info | success | warning | error | approval | message | system
    title, body, link,
    at: NOW(), read: false,
  };
  update(tenantId, (b) => { b.notifications.unshift(n); });
  return n;
}
export function listNotifications(tenantId, employeeId, { unreadOnly = false } = {}) {
  let list = bucket(tenantId).notifications.filter((n) => n.employeeId === employeeId);
  if (unreadOnly) list = list.filter((n) => !n.read);
  return list;
}
export function markNotificationRead(tenantId, id) {
  update(tenantId, (b) => {
    const n = b.notifications.find((x) => x.id === id);
    if (n) n.read = true;
  });
}
export function markAllNotificationsRead(tenantId, employeeId) {
  update(tenantId, (b) => {
    b.notifications.forEach((n) => { if (n.employeeId === employeeId) n.read = true; });
  });
}

/* ============================================================
 *  HOLIDAYS (SEA-flavored)
 * ============================================================ */
function buildHolidays(region) {
  const y = new Date().getFullYear();
  const base = [
    { date: `${y}-01-01`, name: 'New Year',                nameZh: '元旦',     all: true },
    { date: `${y}-12-25`, name: 'Christmas',               nameZh: '圣诞节',   all: true },
  ];
  const sea = {
    SG: [
      { date: `${y}-02-12`, name: 'Chinese New Year',      nameZh: '春节' },
      { date: `${y}-04-04`, name: 'Hari Raya Puasa',       nameZh: '开斋节' },
      { date: `${y}-05-12`, name: 'Vesak Day',             nameZh: '卫塞节' },
      { date: `${y}-06-11`, name: 'Hari Raya Haji',        nameZh: '哈芝节' },
      { date: `${y}-08-09`, name: 'National Day',          nameZh: '新加坡国庆' },
      { date: `${y}-10-31`, name: 'Deepavali',             nameZh: '屠妖节' },
    ],
    MY: [
      { date: `${y}-02-12`, name: 'Tahun Baru Cina',       nameZh: '农历新年' },
      { date: `${y}-04-04`, name: 'Hari Raya Aidilfitri',  nameZh: '开斋节' },
      { date: `${y}-05-12`, name: 'Wesak',                 nameZh: '卫塞节' },
      { date: `${y}-06-11`, name: 'Hari Raya Aidiladha',   nameZh: '哈芝节' },
      { date: `${y}-08-31`, name: 'Hari Merdeka',          nameZh: '马来西亚国庆' },
      { date: `${y}-10-31`, name: 'Deepavali',             nameZh: '屠妖节' },
    ],
    ID: [
      { date: `${y}-03-29`, name: 'Nyepi',                 nameZh: '宁静日' },
      { date: `${y}-04-04`, name: 'Idul Fitri',            nameZh: '开斋节' },
      { date: `${y}-06-11`, name: 'Idul Adha',             nameZh: '哈芝节' },
      { date: `${y}-08-17`, name: 'Hari Kemerdekaan',      nameZh: '印尼独立日' },
      { date: `${y}-09-23`, name: 'Maulid Nabi',           nameZh: '先知诞辰' },
    ],
    VN: [
      { date: `${y}-02-10`, name: 'Tết Nguyên Đán',        nameZh: '越南春节' },
      { date: `${y}-04-30`, name: 'Reunification Day',     nameZh: '解放日' },
      { date: `${y}-05-01`, name: 'Labour Day',            nameZh: '劳动节' },
      { date: `${y}-09-02`, name: 'National Day',          nameZh: '越南国庆' },
    ],
    TH: [
      { date: `${y}-02-12`, name: 'Makha Bucha',           nameZh: '万佛节' },
      { date: `${y}-04-13`, name: 'Songkran',              nameZh: '泼水节' },
      { date: `${y}-05-12`, name: 'Visakha Bucha',         nameZh: '卫塞节' },
      { date: `${y}-12-05`, name: 'King\'s Birthday',      nameZh: '国王生日' },
    ],
    PH: [
      { date: `${y}-04-09`, name: 'Araw ng Kagitingan',    nameZh: '勇敢日' },
      { date: `${y}-04-18`, name: 'Maundy Thursday',       nameZh: '濯足节' },
      { date: `${y}-06-12`, name: 'Independence Day',      nameZh: '菲律宾独立日' },
      { date: `${y}-08-26`, name: 'National Heroes Day',   nameZh: '英雄节' },
      { date: `${y}-11-30`, name: 'Bonifacio Day',         nameZh: '波尼法秀日' },
    ],
    CN: [
      { date: `${y}-02-10`, name: 'Spring Festival',       nameZh: '春节' },
      { date: `${y}-04-05`, name: 'Qingming',              nameZh: '清明节' },
      { date: `${y}-05-01`, name: 'Labour Day',            nameZh: '劳动节' },
      { date: `${y}-06-10`, name: 'Dragon Boat',           nameZh: '端午节' },
      { date: `${y}-09-17`, name: 'Mid-Autumn',            nameZh: '中秋节' },
      { date: `${y}-10-01`, name: 'National Day',          nameZh: '国庆节' },
    ],
  };
  return [...base, ...(sea[region] || sea.SG)].sort((a, b) => a.date.localeCompare(b.date));
}
export function listHolidays(tenantId) { return bucket(tenantId).holidays; }

/* ============================================================
 *  WORKSPACE LAYOUT (pinned apps)
 * ============================================================ */
const DEFAULT_PINNED = ['workflow', 'im', 'attendance', 'leave', 'expense', 'payslip', 'announce', 'handbook', 'training'];
export function getWorkspaceLayout(tenantId, employeeId) {
  const b = bucket(tenantId);
  if (!b.workspaceLayouts[employeeId]) {
    update(tenantId, (bk) => {
      bk.workspaceLayouts[employeeId] = { pinned: [...DEFAULT_PINNED] };
    });
  }
  return bucket(tenantId).workspaceLayouts[employeeId];
}
export function togglePinnedApp(tenantId, employeeId, appKey) {
  update(tenantId, (b) => {
    if (!b.workspaceLayouts[employeeId]) b.workspaceLayouts[employeeId] = { pinned: [...DEFAULT_PINNED] };
    const arr = b.workspaceLayouts[employeeId].pinned;
    const idx = arr.indexOf(appKey);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(appKey);
  });
}

/* ============================================================
 *  SEA STATUTORY EXTENSIONS  (Indonesia / Vietnam / Thai / Philippines)
 * ============================================================ */
export function calcStatutorySEA(region, gross) {
  if (region === 'ID') {
    // BPJS — Indonesia
    const bpjsHealthEmp  = Math.round(Math.min(gross, 12_000_000) * 0.01);
    const bpjsHealthEr   = Math.round(Math.min(gross, 12_000_000) * 0.04);
    const jhtEmp = Math.round(gross * 0.02);
    const jhtEr  = Math.round(gross * 0.037);
    const jpEmp  = Math.round(Math.min(gross, 9_077_600) * 0.01);
    const jpEr   = Math.round(Math.min(gross, 9_077_600) * 0.02);
    const jkkEr  = Math.round(gross * 0.0054);
    const jkmEr  = Math.round(gross * 0.003);
    return {
      employee: [
        { key:'bpjs_health_emp', label:'BPJS Kesehatan', amount:bpjsHealthEmp },
        { key:'jht_emp', label:'JHT (Old Age)',           amount:jhtEmp },
        { key:'jp_emp',  label:'JP (Pension)',            amount:jpEmp },
      ],
      employer: [
        { key:'bpjs_health_er', label:'BPJS Kesehatan (Er)', amount:bpjsHealthEr },
        { key:'jht_er', label:'JHT (Er)',                    amount:jhtEr },
        { key:'jp_er',  label:'JP (Er)',                     amount:jpEr },
        { key:'jkk',    label:'JKK (Work Accident)',         amount:jkkEr },
        { key:'jkm',    label:'JKM (Death Benefit)',         amount:jkmEr },
      ],
    };
  }
  if (region === 'PH') {
    // SSS + PhilHealth + Pag-IBIG — Philippines
    const sssEmp = Math.round(Math.min(gross, 30000) * 0.045);
    const sssEr  = Math.round(Math.min(gross, 30000) * 0.095);
    const phEmp  = Math.round(Math.min(gross, 100000) * 0.025);
    const phEr   = Math.round(Math.min(gross, 100000) * 0.025);
    const pagibigEmp = Math.round(Math.min(gross, 5000) * 0.02);
    const pagibigEr  = Math.round(Math.min(gross, 5000) * 0.02);
    return {
      employee: [
        { key:'sss_emp', label:'SSS (Employee)',         amount:sssEmp },
        { key:'ph_emp',  label:'PhilHealth (Employee)',  amount:phEmp },
        { key:'pag_emp', label:'Pag-IBIG (Employee)',    amount:pagibigEmp },
      ],
      employer: [
        { key:'sss_er', label:'SSS (Employer)',         amount:sssEr },
        { key:'ph_er',  label:'PhilHealth (Employer)',  amount:phEr },
        { key:'pag_er', label:'Pag-IBIG (Employer)',    amount:pagibigEr },
      ],
    };
  }
  if (region === 'VN') {
    // Vietnam Social / Health / Unemployment Insurance
    const siEmp  = Math.round(gross * 0.08);
    const siEr   = Math.round(gross * 0.175);
    const hiEmp  = Math.round(gross * 0.015);
    const hiEr   = Math.round(gross * 0.03);
    const uiEmp  = Math.round(gross * 0.01);
    const uiEr   = Math.round(gross * 0.01);
    return {
      employee: [
        { key:'si_emp', label:'Social Insurance (Emp)',     amount:siEmp },
        { key:'hi_emp', label:'Health Insurance (Emp)',     amount:hiEmp },
        { key:'ui_emp', label:'Unemployment Ins (Emp)',     amount:uiEmp },
      ],
      employer: [
        { key:'si_er', label:'Social Insurance (Er)',     amount:siEr },
        { key:'hi_er', label:'Health Insurance (Er)',     amount:hiEr },
        { key:'ui_er', label:'Unemployment Ins (Er)',     amount:uiEr },
      ],
    };
  }
  if (region === 'TH') {
    // Thailand Social Security
    const ssoEmp = Math.round(Math.min(gross, 15000) * 0.05);
    const ssoEr  = Math.round(Math.min(gross, 15000) * 0.05);
    return {
      employee: [{ key:'sso_emp', label:'SSO (Employee)', amount:ssoEmp }],
      employer: [{ key:'sso_er',  label:'SSO (Employer)', amount:ssoEr  }],
    };
  }
  return { employee: [], employer: [] };
}

/* ============================================================
 *  COMPLIANCE META (per-region)
 * ============================================================ */
export const REGION_META = {
  SG: { name:'Singapore',   nameZh:'新加坡',   currency:'SGD', flag:'🇸🇬', langs:['en','zh','ms'],   schema:'sg' },
  MY: { name:'Malaysia',    nameZh:'马来西亚', currency:'MYR', flag:'🇲🇾', langs:['en','ms','zh'],   schema:'my' },
  ID: { name:'Indonesia',   nameZh:'印度尼西亚',currency:'IDR', flag:'🇮🇩', langs:['id','en'],        schema:'id' },
  VN: { name:'Vietnam',     nameZh:'越南',     currency:'VND', flag:'🇻🇳', langs:['vi','en'],        schema:'vn' },
  TH: { name:'Thailand',    nameZh:'泰国',     currency:'THB', flag:'🇹🇭', langs:['th','en'],        schema:'th' },
  PH: { name:'Philippines', nameZh:'菲律宾',   currency:'PHP', flag:'🇵🇭', langs:['en','fil'],       schema:'ph' },
  CN: { name:'China',       nameZh:'中国',     currency:'CNY', flag:'🇨🇳', langs:['zh','en'],        schema:'cn' },
};

/* ============================================================
 *  HANDBOOK (员工手册 / 知识库)
 * ============================================================ */
function buildHandbookCategories() {
  return [
    { id: 'hb-cat-welcome',  name: '公司介绍',    nameEn: 'Company',      icon: '🏢', sort: 1 },
    { id: 'hb-cat-policy',   name: '行政制度',    nameEn: 'Policies',     icon: '📋', sort: 2 },
    { id: 'hb-cat-leave',    name: '假期与福利',  nameEn: 'Leave & Benefits', icon: '🌴', sort: 3 },
    { id: 'hb-cat-comp',     name: '薪酬绩效',    nameEn: 'Compensation', icon: '💰', sort: 4 },
    { id: 'hb-cat-sec',      name: '信息安全',    nameEn: 'Security',     icon: '🔒', sort: 5 },
    { id: 'hb-cat-sea',      name: 'SEA 区域指南', nameEn: 'SEA Guide',    icon: '🌏', sort: 6 },
    { id: 'hb-cat-it',       name: 'IT 与工具',   nameEn: 'IT & Tools',   icon: '💻', sort: 7 },
  ];
}

function buildHandbookArticles(region) {
  const today = new Date().toISOString();
  const P = REGION_PROFILES[region] || REGION_PROFILES.SG;

  const arts = [
    /* ============ 公司介绍 ============ */
    {
      id: `hb-${region}-welcome`,
      categoryId: 'hb-cat-welcome',
      title: `${P.flag} 欢迎加入 ${P.companyName} · Welcome Onboard`,
      summary: `入职第一周必读：公司在${P.countryZh}的使命、文化、组织架构与本地化政策。`,
      tags: ['必读', '入职', P.code],
      mustRead: true,
      body: [
        '## 一、公司概况',
        `${P.companyName}（${P.countryEn} Pte. Ltd.）成立于 ${P.foundedYear} 年，办公地址位于${P.officeAddress}。`,
        `当前在${P.countryZh}地区共有 ${P.headcount} 名员工，业务覆盖${P.businessLine}。`,
        '',
        '## 二、核心价值观',
        '- **客户为先 (Customer First)** — 一切决策以客户成功为出发点。',
        '- **诚信透明 (Integrity)** — 数据真实、流程透明、责任清晰。',
        '- **持续学习 (Lifelong Learning)** — 每月至少完成一门培训课程。',
        '- **多元包容 (Diversity & Inclusion)** — 尊重不同国家、宗教、语言背景的同事。',
        '',
        '## 三、当地管理团队',
        `- Country Manager：${P.countryManager}`,
        `- HR Director：${P.hrDirector}`,
        `- Finance Lead：${P.financeLead}`,
        '',
        '## 四、入职 30 天目标',
        '1. 完成所有「必读」手册（共 5 篇，标 ⭐ 必读）',
        '2. 完成《新员工入职培训》课程并通过测验',
        `3. 完成《${P.complianceCourseName}》本地合规课程`,
        '4. 与直属主管设定第一季度 OKR',
        '5. 至少与 5 位跨部门同事建立联系',
      ].join('\n'),
    },
    {
      id: `hb-${region}-overview`,
      categoryId: 'hb-cat-welcome',
      title: '员工手册总览 · Handbook Overview',
      summary: `本手册为 ${P.companyName} ${P.countryZh}地区版本（${P.handbookVersion}），按当地法律编写。`,
      tags: ['指引', P.code],
      body: [
        '## 关于本版本',
        `- **版本号**：${P.handbookVersion}`,
        `- **生效日期**：${P.effectiveDate}`,
        `- **适用范围**：${P.companyName}（${P.countryZh}）全体在职员工`,
        `- **依据法律**：${P.lawBasis}`,
        '',
        '## 章节结构',
        '员工手册按主题分为 7 大类：公司介绍、行政制度、假期福利、薪酬绩效、信息安全、当地区域指南、IT 与工具。',
        '',
        '## 阅读建议',
        '- **必读**（标 ⭐）：入职 7 天内必须阅读并标记已读',
        '- **常用**：日常工作中随时查阅',
        '- **专项**：根据角色和地区针对性阅读',
        '',
        '## 版本更新',
        '手册由 HR 每季度审阅一次，重大更新会以「公告」形式推送。',
        `如对手册有疑问，请联系本地 HR：${P.hrEmail}`,
      ].join('\n'),
    },

    /* ============ 行政制度 ============ */
    {
      id: `hb-${region}-attendance`,
      categoryId: 'hb-cat-policy',
      title: `考勤与工时制度（${P.countryZh}）`,
      summary: `标准工时 ${P.workHours.standard}，每周 ${P.workHours.weekly} 小时，符合${P.lawBasis.split('、')[0]}。`,
      tags: ['必读', '考勤', P.code],
      mustRead: true,
      body: [
        '## 一、标准工时',
        `- 周一至${P.workHours.workWeek}：${P.workHours.standard}`,
        `- 午休时间 ${P.workHours.lunch}（不计入工时）`,
        `- 每日有效工时 ${P.workHours.daily} 小时，每周 ${P.workHours.weekly} 小时`,
        `- 法律依据：${P.workHours.lawRef}`,
        '',
        '## 二、弹性工作',
        '- 上下班时间可弹性 ±30 分钟',
        '- 月度迟到次数不得超过 3 次',
        '- 累计 3 次未打卡视为旷工半天',
        '',
        '## 三、远程办公',
        '- 每月可申请 4 天远程，提前 1 天报备主管',
        '- 跨境出差期间默认远程，不计入额度',
        '',
        '## 四、加班',
        `- 工作日加班费率：${P.overtime.weekday}`,
        `- 休息日加班费率：${P.overtime.weekend}`,
        `- 法定假日加班费率：${P.overtime.holiday}`,
        `- 月加班上限：${P.overtime.monthlyCap}`,
        `- 法律依据：${P.overtime.lawRef}`,
      ].join('\n'),
    },
    {
      id: `hb-${region}-dress`,
      categoryId: 'hb-cat-policy',
      title: '着装规范',
      summary: `${P.dressCode}`,
      tags: ['日常', P.code],
      body: [
        '## 日常着装',
        `- ${P.dressCode}`,
        '- 不允许：拖鞋、过短的短裤、印有不当文字图案的服装',
        '',
        '## 客户会议',
        '- 商务正装：男士衬衫 + 西裤，女士套装或商务连衣裙',
        '- 重要客户接待提前与品牌部确认 dress code',
        '',
        '## 宗教与文化',
        `${P.religiousNote}`,
      ].join('\n'),
    },
    {
      id: `hb-${region}-conduct`,
      categoryId: 'hb-cat-policy',
      title: `员工行为准则（${P.countryZh}）`,
      summary: '反贿赂、反骚扰、利益冲突、举报机制。',
      tags: ['必读', '合规', P.code],
      mustRead: true,
      body: [
        '## 一、反贿赂与反腐败',
        `适用法律：${P.antiBribery}`,
        '- 不得收受单笔超过 ' + P.giftLimit + ' 的礼品或款待',
        '- 任何超出阈值的接待必须在合规系统报备',
        '- 政府公职人员相关的款待一律禁止',
        '',
        '## 二、反骚扰',
        `适用法律：${P.harassmentLaw}`,
        '- 严禁基于性别、种族、宗教、年龄、性取向的歧视与骚扰',
        '- 公司设独立的「举报热线」，举报人身份严格保密',
        `- 举报渠道：${P.whistleblowerHotline}`,
        '',
        '## 三、利益冲突',
        '- 兼职、对外投资、亲属在客户/供应商任职 — 必须事前申报',
        '- 申报通道：HRMS「合规申报」',
        '',
        '## 四、违规处理',
        '违规视情节给予警告、降职、解除合同直至追究法律责任。',
      ].join('\n'),
    },

    /* ============ 假期与福利 ============ */
    {
      id: `hb-${region}-leave`,
      categoryId: 'hb-cat-leave',
      title: `请假规则（${P.countryZh}）`,
      summary: `年假 ${P.leave.annualMin}-${P.leave.annualMax} 天、病假 ${P.leave.sick}、产假 ${P.leave.maternity}、陪产假 ${P.leave.paternity}。`,
      tags: ['必读', '假期', P.code],
      mustRead: true,
      body: [
        '## 一、年假 (Annual Leave)',
        `${P.leave.annualPolicy}`,
        '',
        '## 二、病假 (Sick Leave)',
        `${P.leave.sickPolicy}`,
        '',
        '## 三、事假 (Personal Leave)',
        '- 每年 3 天，无薪',
        '- 需提前 1 天向主管申请',
        '',
        '## 四、婚假 (Marriage Leave)',
        `${P.leave.marriage}`,
        '',
        '## 五、产假与陪产假',
        `- 产假：${P.leave.maternityPolicy}`,
        `- 陪产假：${P.leave.paternityPolicy}`,
        `- 法律依据：${P.leave.maternityLaw}`,
        '',
        '## 六、丧假 (Bereavement)',
        '- 直系亲属 3 天，旁系 1 天',
        '',
        '## 七、申请流程',
        '所有请假统一在「流程中心 → 请假申请」提交，2 天以内主管审批，3 天以上需部门负责人 + HR 审批。',
      ].join('\n'),
    },
    {
      id: `hb-${region}-holidays`,
      categoryId: 'hb-cat-leave',
      title: `${P.flag} 法定公共假期 (${new Date().getFullYear()})`,
      summary: `${P.countryZh}本年度法定假期共 ${P.publicHolidays.length} 天，含${P.holidayHighlights}。`,
      tags: ['假期', P.code],
      body: [
        `## ${P.countryZh} ${new Date().getFullYear()} 年法定假期`,
        '',
        '| 日期 | 节日 | 备注 |',
        '|---|---|---|',
        ...P.publicHolidays.map((h) => `| ${h.date} | ${h.name} | ${h.note || ''} |`),
        '',
        '## 假期补偿规则',
        `${P.holidayCompensation}`,
        '',
        '## 公司额外假期',
        '- 公司年会日（财年末，全员休假）',
        '- 创始人日（11 月最后一个周五）',
      ].join('\n'),
    },
    {
      id: `hb-${region}-benefits`,
      categoryId: 'hb-cat-leave',
      title: `员工福利（${P.countryZh}）`,
      summary: `商业保险、年度体检、节日礼金、健身补贴、学习基金 — 福利金额以${P.currency}计。`,
      tags: ['福利', P.code],
      body: [
        '## 健康保障',
        `- 商业医疗保险（员工 + 1 名直系亲属）— 保额 ${P.benefits.insuranceCap}`,
        `- 年度体检：员工 ${P.benefits.checkupEmp} / 主管 ${P.benefits.checkupMgr} / 总监 ${P.benefits.checkupDir}（${P.currency}）`,
        '',
        '## 节日福利',
        `- ${P.benefits.festivalGifts}`,
        '',
        '## 个人成长',
        `- 学习基金：每年 ${P.benefits.learning} ${P.currency}（用于课程、书籍、专业认证）`,
        `- 健身补贴：每月 ${P.benefits.fitness} ${P.currency}`,
        '',
        '## 其他',
        '- 生日当天可申请生日假（半天）',
        '- 入职满 5 年额外奖励 7 天带薪假',
        `- ${P.benefits.specialPerk}`,
      ].join('\n'),
    },

    /* ============ 薪酬与绩效 ============ */
    {
      id: `hb-${region}-payroll`,
      categoryId: 'hb-cat-comp',
      title: `薪酬发放（${P.countryZh}）`,
      summary: `基本工资 + 绩效奖金 + 津贴，每月 ${P.payday} 发放，币种 ${P.currency}。`,
      tags: ['薪酬', P.code],
      body: [
        '## 薪酬结构',
        '- **基本工资 (Base)**：合同约定',
        '- **绩效奖金 (Bonus)**：季度发放，与个人 + 团队 KPI 挂钩',
        '- **津贴 (Allowance)**：交通 / 通讯 / 餐补',
        `- **法定项 (Statutory)**：${P.statutoryItems}`,
        '',
        '## 发放日',
        `每月 ${P.payday}（如遇周末或公共假期则提前到最近工作日）发放上月工资，币种 ${P.currency}。`,
        '',
        '## 工资条',
        '可在「员工自助 → 我的工资条」查看明细，PDF 下载用于办理签证、贷款等用途。',
        '',
        '## 法定奖金',
        `${P.statutoryBonus}`,
        '',
        '## 年终奖',
        '财年结束后第 2 个月发放，金额参考公司业绩 + 个人考评（A=1.5月、B=1月、C=0.5月）。',
      ].join('\n'),
    },
    {
      id: `hb-${region}-statutory`,
      categoryId: 'hb-cat-comp',
      title: `法定缴费明细（${P.countryZh}）`,
      summary: `${P.statutorySystem} — 员工与雇主缴费比例、计算基数、上下限。`,
      tags: ['必读', '合规', P.code],
      mustRead: true,
      body: [
        `## 一、${P.statutorySystem}`,
        '',
        '| 项目 | 员工 | 雇主 | 备注 |',
        '|---|---|---|---|',
        ...P.statutoryTable.map((s) => `| ${s.item} | ${s.emp} | ${s.empr} | ${s.note} |`),
        '',
        '## 二、计算基数与上限',
        `${P.statutoryBase}`,
        '',
        '## 三、年度申报',
        `${P.taxFiling}`,
        '',
        '## 四、查询方式',
        `员工可登录「${P.statutoryPortal}」查询历史缴费记录。HRMS 工资条同时显示当月明细。`,
      ].join('\n'),
    },
    {
      id: `hb-${region}-perf`,
      categoryId: 'hb-cat-comp',
      title: '绩效考评机制',
      summary: 'OKR 季度评审 + 360 度年终评估 + 调薪晋升通道。',
      tags: ['绩效', P.code],
      body: [
        '## OKR 节奏',
        '- 每季度初设定 3-5 个目标（O）+ 关键结果（KR）',
        '- 季中 Check-in（与主管 1:1）',
        '- 季末 Review + 自评 + 主管评分',
        '',
        '## 年度评估',
        '- 12 月初启动 360 度评估（主管 + 同级 + 下属 + 跨部门）',
        '- 评分等级：S / A / B / C / D',
        '',
        '## 调薪与晋升',
        `- 年度调薪窗口：次年 4 月生效，参考${P.countryZh}通胀率 (${P.inflation})`,
        '- 晋升评审每年 2 次（4 月 / 10 月）',
        '- P 序列与 M 序列双通道，避免「只有当管理者才能涨工资」',
      ].join('\n'),
    },

    /* ============ 信息安全 ============ */
    {
      id: `hb-${region}-security`,
      categoryId: 'hb-cat-sec',
      title: `信息安全与数据合规（${P.countryZh}）`,
      summary: `适用法律：${P.dataLaw}，员工日常红线与处理流程。`,
      tags: ['必读', '安全', P.code],
      mustRead: true,
      body: [
        '## 数据分级',
        '- **P0 (机密)**：客户数据、薪酬数据、合同 — 仅授权人员访问',
        '- **P1 (内部)**：产品文档、内部讨论 — 仅在职员工可见',
        '- **P2 (公开)**：营销材料、对外公告',
        '',
        '## 红线行为（一票否决）',
        '1. 私自下载 / 拷贝客户数据库',
        '2. 在公共渠道（GitHub / 论坛）发布公司代码',
        '3. 使用公司设备访问非法网站',
        '4. 离职未交接账号或硬件',
        '',
        '## 日常注意',
        '- 不点击未知邮件链接，遇钓鱼邮件转发到 security@',
        '- 公司笔记本必须开启硬盘加密 + 屏保 5 分钟自动锁',
        '- 公网下访问公司系统必须走 VPN',
        '- 重要凭证使用密码管理器，禁止明文记录',
        '',
        '## 当地隐私法律',
        `**${P.dataLaw}** — ${P.dataLawDetail}`,
        '',
        `数据主体权利（${P.dataLawShort}）：`,
        ...P.dataRights.map((r) => `- ${r}`),
        '',
        '## 数据泄露应急',
        `如发生数据泄露，必须在 ${P.breachWindow} 内向数据保护机构（${P.dpAuthority}）报告。员工发现风险点立即联系 security@。`,
      ].join('\n'),
    },

    /* ============ IT 与工具 ============ */
    {
      id: `hb-${region}-it`,
      categoryId: 'hb-cat-it',
      title: 'IT 工具与账号申请',
      summary: '常用 SaaS 工具账号、设备申请、密码重置、报障流程。',
      tags: ['IT', P.code],
      body: [
        '## 标配工具',
        '- 邮箱 (Workspace)、IM、HRMS、工单系统、文档协同、代码仓库',
        `- 本地化工具：${P.localTools}`,
        '',
        '## 设备配置',
        '- 研发：MacBook Pro 16" 32GB',
        '- 产品/设计：MacBook Pro 14" 16GB + 外接显示器',
        '- 其他：MacBook Air / ThinkPad（根据需要）',
        '',
        '## 申请流程',
        '- 新账号：「流程中心 → 采购申请」或邮件 it@',
        '- 密码重置：自助门户（自动收到验证码）',
        '- 设备报修：工单系统提交「IT 报障」',
        '',
        '## SLA',
        '- 密码重置：即时',
        '- 新账号开通：1 个工作日',
        '- 硬件故障：4 小时响应',
        `- 本地 IT 支持：${P.itSupport}`,
      ].join('\n'),
    },

    /* ============ 当地区域指南 ============ */
    {
      id: `hb-${region}-localguide`,
      categoryId: 'hb-cat-sea',
      title: `${P.flag} ${P.countryZh}本地化运营指南`,
      summary: P.localGuideSummary,
      tags: ['必读', P.code, '本地'],
      mustRead: true,
      body: P.localGuideBody,
    },
  ];

  return arts.map((a) => ({
    ...a,
    readers: [],
    updatedAt: today,
    author: 'HR Team',
    pinned: !!a.mustRead,
    region: P.code,
    version: P.handbookVersion,
  }));
}

/* ============================================================
 *  REGION PROFILES — 每个国家的完整本地化数据
 * ============================================================ */
const REGION_PROFILES = {
  SG: {
    code: 'SG',
    flag: '🇸🇬',
    countryZh: '新加坡',
    countryEn: 'Singapore',
    companyName: 'HRMS Singapore',
    currency: 'SGD',
    foundedYear: 2019,
    headcount: 86,
    officeAddress: '1 Raffles Place, #20-01, Singapore 048616',
    businessLine: '区域总部、产品研发、客户成功',
    countryManager: 'Lim Wei Ming',
    hrDirector: 'Sarah Tan',
    financeLead: 'Daniel Koh',
    hrEmail: 'hr.sg@hrms.demo',
    handbookVersion: 'SG-v2024.Q4',
    effectiveDate: '2024-10-01',
    lawBasis: '《Employment Act》、《Workplace Safety and Health Act》、PDPA',
    payday: '每月最后一个工作日',
    inflation: '~2.8%',
    workHours: {
      standard: '09:00 - 18:00',
      lunch: '12:30 - 13:30',
      daily: 8,
      weekly: 44,
      workWeek: '周五',
      lawRef: 'Employment Act § 38（普通员工每周不超过 44 小时）',
    },
    overtime: {
      weekday: '1.5x 基本时薪',
      weekend: '1.5x',
      holiday: '2x + 1 天调休',
      monthlyCap: '72 小时（Employment Act 上限）',
      lawRef: 'Employment Act § 38',
    },
    dressCode: 'Smart Casual 为日常着装，客户拜访改商务正装',
    religiousNote: '本公司尊重所有员工的宗教着装习惯（Hijab、Turban 等），不得以此为由进行差别对待。',
    antiBribery: '《Prevention of Corruption Act》(PCA) — 由 CPIB 执行',
    giftLimit: 'S$200',
    harassmentLaw: '《Tripartite Guidelines on Fair Employment Practices》（TAFEP）+ 新加坡 2024 年《工作场所公平法案》',
    whistleblowerHotline: '+65 6800 8888 / ethics@hrms.demo',
    leave: {
      annualMin: 7, annualMax: 14, sick: '14 天', maternity: '16 周', paternity: '4 周',
      annualPolicy: '入职第一年 7 天，每年递增 1 天，最高 14 天。Employment Act § 88A 规定最低 7 天。',
      sickPolicy: '14 天门诊病假 + 60 天住院病假，需医生 MC 证明。',
      marriage: '一次性 3 天（法律未强制，公司自定）',
      maternityPolicy: '16 周带薪，由政府报销 8 周（GPML 计划）',
      paternityPolicy: '法定 2 周 + 公司额外 2 周',
      maternityLaw: '《Child Development Co-Savings Act》',
    },
    publicHolidays: [
      { date: '01-01', name: '元旦 New Year', note: '' },
      { date: '02-10', name: '农历新年 Chinese New Year', note: '2 天' },
      { date: '03-29', name: 'Good Friday', note: '' },
      { date: '04-10', name: 'Hari Raya Puasa', note: '' },
      { date: '05-01', name: 'Labour Day', note: '' },
      { date: '05-22', name: 'Vesak Day', note: '' },
      { date: '06-17', name: 'Hari Raya Haji', note: '' },
      { date: '08-09', name: 'National Day 国庆', note: '' },
      { date: '10-31', name: 'Deepavali', note: '' },
      { date: '12-25', name: 'Christmas Day', note: '' },
    ],
    holidayHighlights: '农历新年、Hari Raya、Vesak、Deepavali 等多元宗教节日',
    holidayCompensation: '若公共假期落在周末，下一个工作日为补假日（Employment Act § 88(2)）。',
    benefits: {
      insuranceCap: 'S$100,000', checkupEmp: 200, checkupMgr: 400, checkupDir: 600,
      festivalGifts: '农历新年 / Hari Raya / Deepavali / 圣诞 各 200 SGD，中秋月饼礼盒',
      learning: 1500, fitness: 80,
      specialPerk: '入职满 3 年起，每年额外 1 周「Sabbatical 储备」可累积兑换长假',
    },
    statutoryItems: 'CPF（公民/PR）/ SDL / FWL（外籍）/ 个税 IRAS',
    statutoryBonus: '法律未强制 13 月工资，但市场惯例：年终发放 AWS（Annual Wage Supplement）= 1 个月。',
    statutorySystem: 'CPF (Central Provident Fund) — 由 CPF Board 管理',
    statutoryTable: [
      { item: '普通账户 OA', emp: '14% / 17%', empr: '8% / 9%', note: '55 岁以下；外籍 EP/SP 不缴' },
      { item: '医疗账户 MA', emp: '4% / 5%', empr: '4% / 5%', note: 'MediSave，看病使用' },
      { item: '特别账户 SA', emp: '2% / 3%', empr: '1% / 2%', note: '退休用，55 岁前不可提取' },
      { item: 'SDL', emp: '0%', empr: '0.25%（封顶 11.25 SGD/月）', note: 'Skills Development Levy' },
    ],
    statutoryBase: 'CPF 缴费基数封顶月薪 S$7,400（2025 年），超出部分不计入。',
    taxFiling: 'IRAS — 公司每年 3 月 1 日前 e-file IR8A，员工 4 月 18 日前自助报税。',
    statutoryPortal: 'CPF Board e-Cashier (cpf.gov.sg)',
    dataLaw: 'Personal Data Protection Act (PDPA) 2012',
    dataLawShort: 'PDPA',
    dataLawDetail: '由 PDPC 执行，违规最高罚款 1,000,000 SGD 或全球营收 10%。',
    dataRights: ['访问权（Access）', '更正权（Correction）', '撤回同意（Withdrawal of Consent）', '投诉权（Complaint to PDPC）'],
    breachWindow: '72 小时',
    dpAuthority: 'PDPC (Personal Data Protection Commission)',
    localTools: 'PayBoy（薪资）、SingPass MyInfo（员工身份验证）',
    itSupport: 'IT Helpdesk（office 12 楼）+65 6800 8800',
    complianceCourseName: 'PDPA 合规基础',
    localGuideSummary: 'CPF 公积金、Work Pass 工准证、IRAS 税务、Tripartite 三方调解。',
    localGuideBody: [
      '## 一、CPF 公积金',
      '- 55 岁以下公民/PR：员工 20%，雇主 17%',
      '- 外籍 EP/SP 持有人：不缴 CPF，按合同薪资全额发放',
      '- 月薪封顶 S$7,400，年度封顶 S$102,000',
      '',
      '## 二、Work Pass 工准证',
      '- **EP (Employment Pass)**：月薪 ≥ S$5,000（金融业 ≥ S$5,500）',
      '- **SP (S Pass)**：月薪 ≥ S$3,150，配额 + 15% 雇主 levy',
      '- **WP (Work Permit)**：低技能岗位，雇主需配额',
      '- 续签由 HR 在到期前 6 个月启动',
      '',
      '## 三、IRAS 报税',
      '- 每年 3 月公司代为 e-file IR8A 表格至 IRAS',
      '- 员工于 4 月 18 日前自助 e-file 个税（mytax.iras.gov.sg）',
      '- 累进税率 0% - 24%（2024 调整后）',
      '',
      '## 四、Tripartite 三方调解',
      '劳资纠纷可通过 TADM（Tripartite Alliance for Dispute Management）调解，免费先调后裁。',
      '',
      '## 五、SkillsFuture 培训补贴',
      '每位新加坡公民有 S$500 SkillsFuture Credit，可用于政府认证课程，公司鼓励员工申请。',
    ].join('\n'),
  },

  MY: {
    code: 'MY',
    flag: '🇲🇾',
    countryZh: '马来西亚',
    countryEn: 'Malaysia',
    companyName: 'HRMS Malaysia Sdn. Bhd.',
    currency: 'MYR',
    foundedYear: 2020,
    headcount: 64,
    officeAddress: 'Menara TM, Jalan Pantai Baharu, 50672 Kuala Lumpur',
    businessLine: '研发中心、客户支持',
    countryManager: 'Ahmad Zulkifli',
    hrDirector: 'Nurul Aisyah',
    financeLead: 'Lee Chee Wai',
    hrEmail: 'hr.my@hrms.demo',
    handbookVersion: 'MY-v2024.Q4',
    effectiveDate: '2024-10-01',
    lawBasis: '《Employment Act 1955》、《Industrial Relations Act 1967》、PDPA 2010',
    payday: '每月 25 日',
    inflation: '~2.5%',
    workHours: {
      standard: '09:00 - 18:00',
      lunch: '13:00 - 14:00',
      daily: 8,
      weekly: 45,
      workWeek: '周五',
      lawRef: 'Employment Act § 60A（每周不超过 45 小时）',
    },
    overtime: {
      weekday: '1.5x',
      weekend: '2.0x',
      holiday: '3.0x',
      monthlyCap: '104 小时',
      lawRef: 'Employment Act § 60A(3)',
    },
    dressCode: 'Smart Casual；周五允许 Batik 巴迪传统服',
    religiousNote: '本公司尊重穆斯林员工的礼拜需求（每日 5 次祈祷时段）和 Hijab 着装。提供 Surau 礼拜室。',
    antiBribery: '《Malaysian Anti-Corruption Commission Act 2009》(MACC Act)',
    giftLimit: 'RM 500',
    harassmentLaw: '《Employment Act § 81A-81G》工作场所性骚扰条款',
    whistleblowerHotline: '+60 3-2161 8888 / ethics@hrms.demo',
    leave: {
      annualMin: 8, annualMax: 16, sick: '14-22 天', maternity: '98 天', paternity: '7 天',
      annualPolicy: 'EA § 60E 规定：< 2 年 8 天 / 2-5 年 12 天 / > 5 年 16 天。',
      sickPolicy: '14 天 (< 2 年) / 18 天 (2-5 年) / 22 天 (> 5 年) 带薪，需 MC。',
      marriage: '一次性 3 天',
      maternityPolicy: '法定 98 天带薪（EA 2022 修订）',
      paternityPolicy: '法定 7 天（EA 2022 新增）',
      maternityLaw: 'Employment Act 1955 § 37（2022 修订）',
    },
    publicHolidays: [
      { date: '01-01', name: 'New Year', note: '' },
      { date: '02-01', name: 'Federal Territory Day', note: '吉隆坡' },
      { date: '02-10', name: '农历新年', note: '2 天' },
      { date: '04-10', name: 'Hari Raya Aidilfitri', note: '2 天 ⭐' },
      { date: '05-01', name: 'Labour Day', note: '' },
      { date: '05-22', name: 'Wesak Day', note: '' },
      { date: '06-03', name: 'Agong\'s Birthday', note: '国王诞辰' },
      { date: '06-17', name: 'Hari Raya Haji', note: '' },
      { date: '08-31', name: 'Merdeka Day 独立日', note: '' },
      { date: '09-16', name: 'Malaysia Day', note: '' },
      { date: '10-31', name: 'Deepavali', note: '' },
      { date: '12-25', name: 'Christmas', note: '' },
    ],
    holidayHighlights: 'Hari Raya（开斋节）、Deepavali、农历新年、Merdeka 独立日',
    holidayCompensation: '若假期落在周日，周一自动补假（Holidays Act 1951）。',
    benefits: {
      insuranceCap: 'RM 300,000', checkupEmp: 600, checkupMgr: 1200, checkupDir: 1800,
      festivalGifts: 'Hari Raya / 农历新年 / Deepavali 各 500 MYR 节日礼金',
      learning: 4000, fitness: 250,
      specialPerk: '开斋节前可申请 1 周「balik kampung 返乡假」（年假抵扣）',
    },
    statutoryItems: 'EPF / SOCSO / EIS / HRDF / PCB 个税',
    statutoryBonus: '法律未强制 13 月工资，但市场惯例：Hari Raya 与年终各 1 个月。',
    statutorySystem: 'EPF + SOCSO + EIS + HRDF',
    statutoryTable: [
      { item: 'EPF (KWSP)', emp: '11%', empr: '13% (≤ RM5000) / 12% (> RM5000)', note: '退休公积金' },
      { item: 'SOCSO (PERKESO)', emp: '0.5%', empr: '1.75%', note: '工伤 + 失能保险' },
      { item: 'EIS', emp: '0.2%', empr: '0.2%', note: '失业保险' },
      { item: 'HRDF', emp: '0%', empr: '1%', note: '人力资源发展基金' },
    ],
    statutoryBase: 'EPF 无封顶；SOCSO/EIS 月薪封顶 RM 5,000。',
    taxFiling: 'LHDN — 每月 PCB 预扣，雇主在 3 月 31 日前发 EA Form，员工 4 月 30 日前自助 e-Filing。',
    statutoryPortal: 'KWSP i-Akaun (kwsp.gov.my)',
    dataLaw: 'Personal Data Protection Act 2010 (PDPA)',
    dataLawShort: 'PDPA-MY',
    dataLawDetail: '由 JPDP 执行，违规最高罚款 RM 500,000 或监禁 3 年。',
    dataRights: ['访问权', '更正权', '撤回同意权', '阻止处理权'],
    breachWindow: '72 小时（行业最佳实践）',
    dpAuthority: 'JPDP (Jabatan Perlindungan Data Peribadi)',
    localTools: 'MyEG（政府服务）、Touch \'n Go e-wallet（员工报销）',
    itSupport: 'IT Helpdesk +60 3-2161 8000',
    complianceCourseName: 'PDPA 2010 合规基础',
    localGuideSummary: 'EPF/SOCSO/EIS、PCB 个税、开斋节奖金、Bumiputera 政策、HRDF 培训补贴。',
    localGuideBody: [
      '## 一、法定缴费',
      '- **EPF (KWSP)**：员工 11%，雇主 13% (月薪 ≤ RM5000) / 12% (> RM5000)',
      '- **SOCSO + EIS**：合计员工 0.7%，雇主 1.95%',
      '- **HRDF**：雇主 1%（≥ 10 人企业）',
      '',
      '## 二、PCB 个税',
      '每月预扣，年初汇算清缴（EA Form 由公司 3 月底前发放）。',
      '累进税率 0% - 30%（2024）。',
      '',
      '## 三、节日奖金（市场惯例）',
      '- 开斋节、农历新年、屠妖节各发放节日 Bonus',
      '- 金额视公司业绩，通常 0.5-1 个月工资',
      '',
      '## 四、Bumiputera 政策',
      '部分政府项目要求 Bumi 股权比例，本公司作为外资企业不受此限制。但鼓励多元招聘。',
      '',
      '## 五、HRDF 培训补贴',
      '公司每年向 HRDF 缴纳 1% 工资作为培训基金，员工可申请政府认证课程报销。',
      '',
      '## 六、Foreign Worker',
      '外籍员工需办理 Employment Pass (EP)，由 ESD 在线申请。EP 持有人不参与 EPF/SOCSO，但需参加 SKHPPA 健康保险。',
    ].join('\n'),
  },

  ID: {
    code: 'ID',
    flag: '🇮🇩',
    countryZh: '印度尼西亚',
    countryEn: 'Indonesia',
    companyName: 'PT HRMS Indonesia',
    currency: 'IDR',
    foundedYear: 2021,
    headcount: 52,
    officeAddress: 'Sahid Sudirman Center, Jl. Jend. Sudirman Kav. 86, Jakarta 10220',
    businessLine: '销售、客户成功、本地化产品',
    countryManager: 'Budi Santoso',
    hrDirector: 'Sri Wahyuni',
    financeLead: 'Andi Pratama',
    hrEmail: 'hr.id@hrms.demo',
    handbookVersion: 'ID-v2024.Q4',
    effectiveDate: '2024-10-01',
    lawBasis: 'UU Cipta Kerja No. 6/2023、UU Ketenagakerjaan No. 13/2003、UU PDP No. 27/2022',
    payday: '每月 25 日',
    inflation: '~3.2%',
    workHours: {
      standard: '08:00 - 17:00',
      lunch: '12:00 - 13:00',
      daily: 8,
      weekly: 40,
      workWeek: '周五',
      lawRef: 'UU Cipta Kerja Pasal 81 angka 21（每周不超过 40 小时）',
    },
    overtime: {
      weekday: '第 1 小时 1.5x，之后 2.0x',
      weekend: '2.0x（前 7 小时）至 4.0x',
      holiday: '2.0x - 4.0x（根据小时段）',
      monthlyCap: '14 小时/周（PP 35/2021）',
      lawRef: 'PP 35/2021 Pasal 31',
    },
    dressCode: '日常 Smart Casual；周五允许 Batik 印尼蜡染衬衫',
    religiousNote: '本公司尊重穆斯林员工每日 5 次礼拜需求和斋月禁食。提供 Mushola 礼拜室。Hijab 与男性 Peci 等宗教着装受尊重。',
    antiBribery: '《UU No. 31/1999 Tindak Pidana Korupsi》(KPK Act)',
    giftLimit: 'IDR 1,000,000',
    harassmentLaw: '《UU TPKS No. 12/2022》性暴力犯罪法',
    whistleblowerHotline: '+62 21 5790 0888 / ethics@hrms.demo',
    leave: {
      annualMin: 12, annualMax: 12, sick: '医生证明全额', maternity: '3 个月', paternity: '2 天',
      annualPolicy: 'UU 13/2003 Pasal 79：满 1 年享 12 天，每年重置（不可累积超 2 年）。',
      sickPolicy: '凭医生证明，前 4 个月 100% 工资；4-8 月 75%；8-12 月 50%；后 25%。',
      marriage: '一次性 3 天（法定）',
      maternityPolicy: '法定 1.5 月产前 + 1.5 月产后 = 3 个月；UU KIA 2024 拟扩展至 6 个月',
      paternityPolicy: '法定 2 天；公司额外 5 天 = 7 天',
      maternityLaw: 'UU Ketenagakerjaan No. 13/2003 Pasal 82',
    },
    publicHolidays: [
      { date: '01-01', name: 'Tahun Baru 新年', note: '' },
      { date: '02-10', name: 'Imlek 农历新年', note: '' },
      { date: '03-11', name: 'Hari Raya Nyepi', note: '巴厘印度教' },
      { date: '03-29', name: 'Wafat Isa Almasih', note: '受难节' },
      { date: '04-10', name: 'Idul Fitri 开斋节', note: '2 天 ⭐' },
      { date: '05-01', name: 'Hari Buruh 劳动节', note: '' },
      { date: '05-09', name: 'Kenaikan Isa Almasih', note: '基督升天' },
      { date: '05-23', name: 'Hari Raya Waisak', note: '佛诞' },
      { date: '06-01', name: 'Hari Lahir Pancasila', note: '建国五原则' },
      { date: '06-17', name: 'Idul Adha', note: '宰牲节' },
      { date: '08-17', name: 'Hari Kemerdekaan 独立日', note: '⭐' },
      { date: '12-25', name: 'Natal 圣诞', note: '' },
    ],
    holidayHighlights: 'Idul Fitri 开斋节、独立日 8.17、Nyepi 静默日',
    holidayCompensation: 'Cuti Bersama（政府指定联休日）由公司年初公布，员工年假抵扣。',
    benefits: {
      insuranceCap: 'IDR 500,000,000', checkupEmp: 800000, checkupMgr: 1500000, checkupDir: 2500000,
      festivalGifts: 'Idul Fitri / Natal 各发 THR + 礼包',
      learning: 8000000, fitness: 500000,
      specialPerk: '斋月期间提供晚间开斋餐（Iftar），并安排远程办公',
    },
    statutoryItems: 'BPJS Kesehatan / BPJS Ketenagakerjaan / PPh 21 个税',
    statutoryBonus: '**THR (Tunjangan Hari Raya) — 法律强制**：开斋节前 7 天发放，工龄满 1 年 = 1 个月工资。',
    statutorySystem: 'BPJS (Badan Penyelenggara Jaminan Sosial) — 健康与劳动保险',
    statutoryTable: [
      { item: 'BPJS Kesehatan', emp: '1%', empr: '4%', note: '健康保险，封顶月薪 IDR 12,000,000' },
      { item: 'JHT (老年保障)', emp: '2%', empr: '3.7%', note: '退休时一次性领取' },
      { item: 'JP (养老金)', emp: '1%', empr: '2%', note: '月领养老金' },
      { item: 'JKK (工伤)', emp: '0%', empr: '0.24%-1.74%', note: '按行业风险等级' },
      { item: 'JKM (死亡保障)', emp: '0%', empr: '0.3%', note: '一次性赔付' },
    ],
    statutoryBase: 'BPJS Kesehatan 封顶 IDR 12,000,000；BPJS Ketenagakerjaan 按实际工资。',
    taxFiling: 'DJP (Direktorat Jenderal Pajak) — 公司代扣 PPh 21，年初发放 1721-A1 表格，员工 3 月底前 e-Filing。',
    statutoryPortal: 'BPJSTK Mobile + JKN Mobile App',
    dataLaw: 'UU Perlindungan Data Pribadi No. 27/2022 (UU PDP)',
    dataLawShort: 'UU PDP',
    dataLawDetail: '2024 年 10 月正式生效，违规最高罚款营收 2% 或监禁 6 年。',
    dataRights: ['访问权', '更正权', '删除权（被遗忘权）', '撤回同意权', '反对自动决策权'],
    breachWindow: '72 小时',
    dpAuthority: 'Lembaga Pelindungan Data Pribadi',
    localTools: 'OVO / GoPay / DANA（员工报销）、Pajak DJP Online',
    itSupport: 'IT Helpdesk Jakarta +62 21 5790 8800',
    complianceCourseName: 'UU PDP 个人数据保护合规',
    localGuideSummary: 'BPJS、PPh 21、THR 开斋节奖金、斋月工时、Cuti Bersama 联休。',
    localGuideBody: [
      '## 一、社保 BPJS',
      '- **BPJS Kesehatan**：员工 1%，雇主 4%（封顶月薪 IDR 12,000,000）',
      '- **BPJS Ketenagakerjaan**：',
      '  - JHT 老年保障：员工 2%，雇主 3.7%',
      '  - JP 养老金：员工 1%，雇主 2%',
      '  - JKK 工伤保险：雇主 0.24%-1.74%（按行业）',
      '  - JKM 死亡保障：雇主 0.3%',
      '',
      '## 二、个税 PPh 21',
      '- 累进税率 5% / 15% / 25% / 30% / 35%',
      '- 每年由公司代扣代缴，1721-A1 表格年初发放',
      '- 员工 3 月底前在 DJP Online 自助 e-Filing',
      '',
      '## 三、THR 奖金（法律强制）',
      '- **Tunjangan Hari Raya** — UU 13/2003 强制规定',
      '- 工作满 1 年：1 个月工资；不足 1 年按月折算',
      '- 必须在 Idul Fitri 前 7 天发放',
      '- 延迟支付按日罚款 5%，最高 1 倍 THR',
      '',
      '## 四、斋月工作安排（Ramadan）',
      '- 工作日缩短 1 小时（08:00 - 16:00）',
      '- 提供晚间开斋餐（Iftar）',
      '- 礼拜空间（Mushola）位于办公楼 4 楼东侧',
      '- 鼓励远程办公以便家庭团聚',
      '',
      '## 五、Cuti Bersama 联休制度',
      '政府每年发布联休日清单（通常 4-6 天），员工年假抵扣。HR 1 月公布全年安排。',
      '',
      '## 六、外籍员工 KITAS',
      '外籍员工需办理 KITAS（限制居留证）+ IMTA（工作许可），公司协助申请。最长 1 年，可续。',
    ].join('\n'),
  },

  VN: {
    code: 'VN',
    flag: '🇻🇳',
    countryZh: '越南',
    countryEn: 'Vietnam',
    companyName: 'HRMS Vietnam Co., Ltd.',
    currency: 'VND',
    foundedYear: 2022,
    headcount: 38,
    officeAddress: 'Bitexco Financial Tower, 2 Hai Trieu, District 1, Ho Chi Minh City',
    businessLine: '研发中心、本地化',
    countryManager: 'Nguyen Van Hung',
    hrDirector: 'Tran Thi Mai',
    financeLead: 'Pham Quoc Bao',
    hrEmail: 'hr.vn@hrms.demo',
    handbookVersion: 'VN-v2024.Q4',
    effectiveDate: '2024-10-01',
    lawBasis: 'Bộ luật Lao động 2019 (45/2019/QH14)、Luật An ninh mạng 2018',
    payday: '每月 5 日（发放上月工资）',
    inflation: '~3.5%',
    workHours: {
      standard: '08:30 - 17:30',
      lunch: '12:00 - 13:00',
      daily: 8,
      weekly: 48,
      workWeek: '周六上午',
      lawRef: 'Bộ luật Lao động 2019 Điều 105（每周不超过 48 小时；公司执行 40 小时）',
    },
    overtime: {
      weekday: '1.5x',
      weekend: '2.0x',
      holiday: '3.0x',
      monthlyCap: '40 小时/月，200 小时/年（特殊行业 300）',
      lawRef: 'Bộ luật Lao động Điều 107',
    },
    dressCode: '日常 Smart Casual；正式场合男士衬衫女士 Áo dài 受欢迎',
    religiousNote: '本公司尊重佛教、天主教、和好教等多元信仰，重要宗教节日可申请事假。',
    antiBribery: '《Luật Phòng, chống tham nhũng 2018》(反腐败法)',
    giftLimit: 'VND 1,000,000',
    harassmentLaw: 'Bộ luật Lao động 2019 Điều 84-85 工作场所性骚扰条款',
    whistleblowerHotline: '+84 28 3823 8888 / ethics@hrms.demo',
    leave: {
      annualMin: 12, annualMax: 16, sick: '30-60 天', maternity: '6 个月', paternity: '5-14 天',
      annualPolicy: 'BLLD 2019 Điều 113：标准 12 天，每 5 年 +1 天。',
      sickPolicy: '由社保 SI 承担：< 15 年工龄 30 天/年，> 30 年工龄 60 天/年。',
      marriage: '本人 3 天，子女 1 天（法定）',
      maternityPolicy: '法定 6 个月带薪（由 SI 报销）— 全亚洲最长之一',
      paternityPolicy: '5-14 天（依产妇生产方式）',
      maternityLaw: 'Luật Bảo hiểm xã hội 2014 Điều 34',
    },
    publicHolidays: [
      { date: '01-01', name: 'Tết Dương Lịch 元旦', note: '' },
      { date: '02-08', name: 'Tết Nguyên Đán 春节', note: '5 天 ⭐⭐' },
      { date: '04-18', name: 'Giỗ Tổ Hùng Vương', note: '雄王节' },
      { date: '04-30', name: 'Giải Phóng Miền Nam', note: '解放日' },
      { date: '05-01', name: 'Quốc Tế Lao Động', note: '劳动节' },
      { date: '09-02', name: 'Quốc Khánh 国庆', note: '2 天' },
    ],
    holidayHighlights: 'Tết 春节（5 天，最重要）、国庆 9.2',
    holidayCompensation: '假期落周末顺延至下一工作日（BLLD Điều 112）。Tết 联休可达 9 天。',
    benefits: {
      insuranceCap: 'VND 500,000,000', checkupEmp: 2000000, checkupMgr: 4000000, checkupDir: 6000000,
      festivalGifts: 'Tết 红包 5,000,000 VND + 节日礼盒',
      learning: 15000000, fitness: 1000000,
      specialPerk: 'Tết 前发放 13 月工资（市场惯例）',
    },
    statutoryItems: 'SI 社保 / HI 医保 / UI 失业保险 / PIT 个税 / TU 工会费',
    statutoryBonus: '**Lương tháng 13（13 月工资）— 市场强制**：Tết 前发放，1 个月工资。',
    statutorySystem: 'SI + HI + UI（强制三保）+ TU 工会',
    statutoryTable: [
      { item: 'SI 社会保险', emp: '8%', empr: '17.5%', note: '含养老 + 死亡 + 病假 + 产假' },
      { item: 'HI 健康保险', emp: '1.5%', empr: '3%', note: '医疗' },
      { item: 'UI 失业保险', emp: '1%', empr: '1%', note: '失业救济' },
      { item: 'TU 工会费', emp: '1%', empr: '2%', note: '工会运营' },
    ],
    statutoryBase: 'SI/HI 月薪封顶 = 20 倍基本工资 (~36,000,000 VND)；UI 封顶 = 20 倍区域最低工资。',
    taxFiling: 'Tổng cục Thuế — 公司代扣 PIT，2 月底前完成年度汇算（quyết toán）。',
    statutoryPortal: 'VSS Mobile + eTax',
    dataLaw: 'Nghị định 13/2023/NĐ-CP 个人数据保护法令',
    dataLawShort: 'NĐ 13/2023',
    dataLawDetail: '2023 年 7 月生效，是越南首部完整的个人数据保护法规，由 A05 公安部网络警察执行。',
    dataRights: ['知情权', '同意撤回权', '访问权', '更正权', '删除权', '限制处理权'],
    breachWindow: '72 小时（向 A05 报告）',
    dpAuthority: 'A05 - Cục An ninh mạng và phòng, chống tội phạm sử dụng công nghệ cao',
    localTools: 'Momo / ZaloPay（员工报销）、eTax Mobile',
    itSupport: 'IT Helpdesk HCMC +84 28 3823 8000',
    complianceCourseName: 'NĐ 13/2023 个人数据保护合规',
    localGuideSummary: 'SI/HI/UI 三保、PIT 个税、Tết 春节奖金、13 月工资、Lao động Việt Nam 劳动法。',
    localGuideBody: [
      '## 一、强制三保',
      '- **Social Insurance (SI)**：员工 8%，雇主 17.5%',
      '- **Health Insurance (HI)**：员工 1.5%，雇主 3%',
      '- **Unemployment Insurance (UI)**：员工 1%，雇主 1%',
      '- **Trade Union (TU)**：员工 1%，雇主 2%',
      '',
      '## 二、个税 PIT',
      '- 累进 5% / 10% / 15% / 20% / 25% / 30% / 35%',
      '- 由公司代扣，每年 2 月底前完成年度汇算',
      '',
      '## 三、Tết 春节奖金',
      '- 法定假期 5 天（农历除夕至初四）',
      '- **Lương tháng 13（13 月工资）**：市场强制，Tết 前发放 1 个月工资',
      '- 公司另发 Tết 红包 5,000,000 VND',
      '',
      '## 四、工时',
      '- 法定每周 48 小时（含周六上午），公司执行 40 小时（周一至周五）',
      '- 加班月度上限 40 小时，年度 200 小时',
      '',
      '## 五、外籍员工 Work Permit',
      '外籍员工须办理工作许可证（最长 2 年）+ 临时居留卡 TRC。需提供学历公证、犯罪记录、健康证明。',
      '',
      '## 六、最低工资分区',
      '越南分 4 个区，第 1 区（HCM/河内）月最低工资 4,960,000 VND（2024）。公司薪资远高于此。',
    ].join('\n'),
  },

  TH: {
    code: 'TH',
    flag: '🇹🇭',
    countryZh: '泰国',
    countryEn: 'Thailand',
    companyName: 'HRMS Thailand Co., Ltd.',
    currency: 'THB',
    foundedYear: 2022,
    headcount: 31,
    officeAddress: 'Empire Tower, 1 South Sathorn Road, Yannawa, Bangkok 10120',
    businessLine: '销售、客户成功',
    countryManager: 'Somchai Phongsri',
    hrDirector: 'Niran Suwannaphum',
    financeLead: 'Pim Jiranuwat',
    hrEmail: 'hr.th@hrms.demo',
    handbookVersion: 'TH-v2024.Q4',
    effectiveDate: '2024-10-01',
    lawBasis: '《Labour Protection Act B.E. 2541》、PDPA B.E. 2562',
    payday: '每月最后一个工作日',
    inflation: '~1.2%',
    workHours: {
      standard: '08:30 - 17:30',
      lunch: '12:00 - 13:00',
      daily: 8,
      weekly: 48,
      workWeek: '周五',
      lawRef: 'Labour Protection Act § 23（每周不超过 48 小时；公司执行 40 小时）',
    },
    overtime: {
      weekday: '1.5x',
      weekend: '2.0x（正常工时）',
      holiday: '3.0x',
      monthlyCap: '36 小时/周',
      lawRef: 'Labour Protection Act § 61-63',
    },
    dressCode: '日常 Smart Casual；周五允许传统泰式 Phra Phra 衬衫',
    religiousNote: '本公司尊重佛教节日（如僧侣化缘、守夏节），重要宗教仪式可申请事假。',
    antiBribery: '《Organic Act on Anti-Corruption B.E. 2561》',
    giftLimit: 'THB 3,000',
    harassmentLaw: 'Labour Protection Act § 16 工作场所性骚扰禁令',
    whistleblowerHotline: '+66 2 670 8888 / ethics@hrms.demo',
    leave: {
      annualMin: 6, annualMax: 12, sick: '30 天', maternity: '98 天', paternity: '15 天',
      annualPolicy: 'LPA § 30：满 1 年享 6 天，每年递增至最高 12 天。',
      sickPolicy: '法定 30 天带薪，需医生证明（>3 天必须）。',
      marriage: '一次性 3 天',
      maternityPolicy: '法定 98 天，前 45 天由公司支付，后 45 天由 SSO 报销 50%',
      paternityPolicy: '公司自定 15 天（法律未强制）',
      maternityLaw: 'Labour Protection Act § 41',
    },
    publicHolidays: [
      { date: '01-01', name: 'New Year', note: '' },
      { date: '02-26', name: 'Makha Bucha 万佛节', note: '佛历' },
      { date: '04-06', name: 'Chakri Memorial Day', note: '却克里王朝纪念日' },
      { date: '04-13', name: 'Songkran 泼水节', note: '3 天 ⭐' },
      { date: '05-01', name: 'Labour Day', note: '' },
      { date: '05-04', name: 'Coronation Day', note: '加冕日' },
      { date: '05-22', name: 'Visakha Bucha 卫塞节', note: '佛历' },
      { date: '07-20', name: 'Asahna Bucha 三宝节', note: '佛历' },
      { date: '07-28', name: 'King\'s Birthday', note: '国王诞辰' },
      { date: '08-12', name: 'Queen Mother\'s Birthday', note: '母亲节' },
      { date: '10-13', name: 'King Rama IX Memorial', note: '' },
      { date: '10-23', name: 'Chulalongkorn Day', note: '' },
      { date: '12-05', name: 'King Father\'s Birthday', note: '父亲节' },
      { date: '12-10', name: 'Constitution Day', note: '' },
      { date: '12-31', name: 'New Year\'s Eve', note: '' },
    ],
    holidayHighlights: 'Songkran 泼水节、佛历节日（万佛节/卫塞节/三宝节）、国王/王后诞辰',
    holidayCompensation: '假期落周末顺延至下一工作日。LPA § 29 规定每年至少 13 天公共假期。',
    benefits: {
      insuranceCap: 'THB 1,000,000', checkupEmp: 4000, checkupMgr: 8000, checkupDir: 12000,
      festivalGifts: 'Songkran / 新年各发 3,000 THB 节日礼金',
      learning: 30000, fitness: 1500,
      specialPerk: 'Songkran 期间办公室关闭 1 周，员工可全员休假',
    },
    statutoryItems: 'SSO 社保 / WCF 工伤 / PIT 个税',
    statutoryBonus: '法律未强制 13 月工资，但市场惯例：年终 1-2 个月。',
    statutorySystem: 'SSO (Social Security Office) + WCF (Workmen Compensation Fund)',
    statutoryTable: [
      { item: 'SSO 社保', emp: '5%', empr: '5%', note: '医疗 + 养老 + 失业，封顶月薪 15,000 THB' },
      { item: 'WCF 工伤', emp: '0%', empr: '0.2%-1.0%', note: '按行业风险' },
      { item: 'Provident Fund', emp: '2-15%（自选）', empr: '2-15%', note: '公司自愿计划，公司匹配员工' },
    ],
    statutoryBase: 'SSO 封顶月薪 15,000 THB（即员工月缴最高 750 THB）。',
    taxFiling: 'Revenue Department — 公司代扣 PIT，员工 3 月底前完成 P.N.D.91 自助申报。',
    statutoryPortal: 'SSO e-Service (sso.go.th)',
    dataLaw: 'Personal Data Protection Act B.E. 2562 (PDPA-TH)',
    dataLawShort: 'PDPA-TH',
    dataLawDetail: '2022 年 6 月正式生效，由 PDPC 执行，违规最高罚款 5,000,000 THB + 营收 5%。',
    dataRights: ['访问权', '更正权', '删除权', '限制处理权', '数据可携权', '反对权'],
    breachWindow: '72 小时',
    dpAuthority: 'PDPC Thailand (สำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล)',
    localTools: 'PromptPay（员工报销）、Revenue Department e-Filing',
    itSupport: 'IT Helpdesk Bangkok +66 2 670 8000',
    complianceCourseName: 'PDPA 2562 合规基础',
    localGuideSummary: 'SSO 社保、PIT 个税、Songkran 泼水节、佛历假期、外籍 Work Permit。',
    localGuideBody: [
      '## 一、SSO 社保',
      '- 员工 5%，雇主 5%（封顶月薪 15,000 THB）',
      '- 即员工每月最高缴 750 THB',
      '- 涵盖：医疗 / 养老 / 失业 / 生育 / 工伤 / 死亡',
      '',
      '## 二、个税 PIT',
      '- 累进 0% - 35%，年收入 < 150,000 THB 免税',
      '- 公司代扣，员工 3 月底前自助申报 P.N.D.91',
      '',
      '## 三、Songkran 泼水节',
      '- 4 月 13-15 日，法定假期 3 天',
      '- 公司办公室关闭 1 周（含周末），全员休假',
      '- 建议在节日期间妥善保管手机等电子设备（防水袋）',
      '',
      '## 四、佛历假期',
      '- 万佛节（Makha Bucha）、卫塞节（Visakha Bucha）、三宝节（Asahna Bucha）为法定假期',
      '- 节日期间禁止销售酒精饮品',
      '',
      '## 五、Provident Fund（公司自愿福利）',
      '员工可选择 2-15% 工资缴入，公司匹配相同比例。退休或离职 5 年后可领取。',
      '',
      '## 六、外籍员工 Work Permit',
      '外籍员工须办理 Work Permit + Non-B Visa。最低工资门槛 50,000 THB/月（中国/印度等国家）。',
    ].join('\n'),
  },

  PH: {
    code: 'PH',
    flag: '🇵🇭',
    countryZh: '菲律宾',
    countryEn: 'Philippines',
    companyName: 'HRMS Philippines Inc.',
    currency: 'PHP',
    foundedYear: 2023,
    headcount: 28,
    officeAddress: 'BGC Corporate Center, 11th Avenue cor. 30th Street, Taguig 1634',
    businessLine: '客户支持、BPO 后台',
    countryManager: 'Maria Cruz',
    hrDirector: 'Juan Dela Rosa',
    financeLead: 'Andrea Reyes',
    hrEmail: 'hr.ph@hrms.demo',
    handbookVersion: 'PH-v2024.Q4',
    effectiveDate: '2024-10-01',
    lawBasis: 'Labor Code of the Philippines (PD 442)、Data Privacy Act 2012 (RA 10173)',
    payday: '每月 15 日 + 30 日（半月发薪）',
    inflation: '~3.8%',
    workHours: {
      standard: '09:00 - 18:00',
      lunch: '12:00 - 13:00',
      daily: 8,
      weekly: 48,
      workWeek: '周五',
      lawRef: 'Labor Code Art. 83（每周不超过 48 小时；公司执行 40 小时）',
    },
    overtime: {
      weekday: '1.25x',
      weekend: '1.3x',
      holiday: '2.0x（regular holiday） / 1.3x（special non-working day）',
      monthlyCap: '法律无明确上限，公司限制 30 小时/月',
      lawRef: 'Labor Code Art. 87-89',
    },
    dressCode: '日常 Smart Casual；客户拜访商务正装',
    religiousNote: '本公司尊重天主教（85% 国民信仰）的弥撒习惯，重要节日（如圣周）可申请事假。',
    antiBribery: '《Anti-Graft and Corrupt Practices Act》(RA 3019)',
    giftLimit: 'PHP 5,000',
    harassmentLaw: 'Safe Spaces Act (RA 11313) — 工作场所性骚扰',
    whistleblowerHotline: '+63 2 8800 8888 / ethics@hrms.demo',
    leave: {
      annualMin: 5, annualMax: 5, sick: '法律未强制', maternity: '105 天', paternity: '7 天',
      annualPolicy: '法定 Service Incentive Leave (SIL) 5 天（满 1 年）。公司额外给 10 天。',
      sickPolicy: '法律未强制，公司提供 10 天带薪病假。SSS 病假补贴需医生证明 + 4 天以上。',
      marriage: '一次性 3 天',
      maternityPolicy: '法定 105 天带薪 + 可选额外 30 天无薪（Expanded Maternity Leave Law RA 11210）',
      paternityPolicy: '法定 7 天 + 公司额外 7 天 = 14 天',
      maternityLaw: 'RA 11210 (2019)',
    },
    publicHolidays: [
      { date: '01-01', name: 'New Year', note: '' },
      { date: '02-10', name: 'Chinese New Year', note: 'Special non-working' },
      { date: '02-25', name: 'EDSA People Power Revolution', note: 'Special' },
      { date: '03-28', name: 'Maundy Thursday', note: '圣周' },
      { date: '03-29', name: 'Good Friday', note: '圣周 ⭐' },
      { date: '04-09', name: 'Araw ng Kagitingan', note: '勇气日' },
      { date: '04-10', name: 'Eid\'l Fitr', note: '' },
      { date: '05-01', name: 'Labor Day', note: '' },
      { date: '06-12', name: 'Independence Day 独立日', note: '⭐' },
      { date: '06-17', name: 'Eid\'l Adha', note: '' },
      { date: '08-26', name: 'National Heroes Day', note: '' },
      { date: '11-01', name: 'All Saints Day', note: '' },
      { date: '11-30', name: 'Bonifacio Day', note: '' },
      { date: '12-08', name: 'Feast of Immaculate Conception', note: '' },
      { date: '12-25', name: 'Christmas Day', note: '⭐' },
      { date: '12-30', name: 'Rizal Day', note: '' },
      { date: '12-31', name: 'New Year\'s Eve', note: '' },
    ],
    holidayHighlights: '圣周 Holy Week（4 天）、独立日 6.12、圣诞节、双假日制度（Regular + Special）',
    holidayCompensation: 'Regular Holiday：不上班照发 100% 工资；Special Non-working：不上班无薪。',
    benefits: {
      insuranceCap: 'PHP 1,500,000', checkupEmp: 5000, checkupMgr: 10000, checkupDir: 15000,
      festivalGifts: '圣诞节 / Holy Week 各发 5,000 PHP 节日礼金',
      learning: 30000, fitness: 1500,
      specialPerk: '12 月 24 日前必发 13th Month Pay（法律强制）',
    },
    statutoryItems: 'SSS / PhilHealth / Pag-IBIG / BIR 个税',
    statutoryBonus: '**13th Month Pay — 法律强制**：12 月 24 日前发放，= 全年基本工资 / 12。',
    statutorySystem: 'SSS + PhilHealth + Pag-IBIG（三项法定缴费）',
    statutoryTable: [
      { item: 'SSS 社保', emp: '4.5%', empr: '9.5%', note: '退休 + 残疾 + 死亡，封顶月薪 30,000 PHP' },
      { item: 'PhilHealth 医保', emp: '2.5%', empr: '2.5%', note: '健康保险，2024 费率' },
      { item: 'Pag-IBIG (HDMF)', emp: '2%（最低）', empr: '2%', note: '住房公积金，封顶 100 PHP' },
    ],
    statutoryBase: 'SSS 封顶月薪 30,000 PHP；PhilHealth 上下限 10,000-100,000 PHP。',
    taxFiling: 'BIR (Bureau of Internal Revenue) — 公司代扣 PIT，1 月 31 日前发 BIR 2316，员工 4 月 15 日前自助申报。',
    statutoryPortal: 'SSS My.SSS Mobile + PhilHealth Member Portal',
    dataLaw: 'Data Privacy Act of 2012 (RA 10173)',
    dataLawShort: 'DPA',
    dataLawDetail: '由 NPC 执行，违规最高罚款 5,000,000 PHP + 监禁 6 年。',
    dataRights: ['知情权', '访问权', '更正权', '删除权', '数据可携权', '损害赔偿权'],
    breachWindow: '72 小时（向 NPC 报告）',
    dpAuthority: 'NPC (National Privacy Commission)',
    localTools: 'GCash / Maya（员工报销）、BIR eFPS',
    itSupport: 'IT Helpdesk Manila +63 2 8800 8000',
    complianceCourseName: 'Data Privacy Act 合规基础',
    localGuideSummary: 'SSS/PhilHealth/Pag-IBIG 三项缴费、13th Month Pay、Holy Week、双假日制度。',
    localGuideBody: [
      '## 一、法定缴费',
      '- **SSS**：员工 4.5%，雇主 9.5%（封顶月薪 30,000 PHP）',
      '- **PhilHealth**：员工 2.5%，雇主 2.5%',
      '- **Pag-IBIG (HDMF)**：员工 2%，雇主 2%（封顶 100 PHP）',
      '',
      '## 二、13th Month Pay（法律强制）',
      '- 法律强制，必须在 12 月 24 日前发放',
      '- 金额 = 全年基本工资 / 12',
      '- 适用于所有月薪低于 PHP 90,000 的员工（其余员工免税）',
      '',
      '## 三、Service Incentive Leave',
      '工作满 1 年的员工享有法定 5 天带薪假期（公司年假之外）。可折现。',
      '',
      '## 四、Holy Week 圣周',
      '- Maundy Thursday + Good Friday + Black Saturday + Easter Sunday',
      '- 公司允许 4 天连休，员工年假抵扣 2 天',
      '',
      '## 五、双假日制度',
      '- **Regular Holiday**：不上班照发 100% 工资；加班 2.0x',
      '- **Special Non-working Day**：不上班无薪；加班 1.3x',
      '',
      '## 六、外籍员工 9G Visa',
      '外籍员工须办理 9G Work Visa + Alien Employment Permit (AEP)。最长 3 年，可续。',
    ].join('\n'),
  },

  CN: {
    code: 'CN',
    flag: '🇨🇳',
    countryZh: '中国',
    countryEn: 'China',
    companyName: 'HRMS 中国（上海）有限公司',
    currency: 'CNY',
    foundedYear: 2018,
    headcount: 124,
    officeAddress: '上海市浦东新区世纪大道 1198 号世纪汇广场 T2 28 楼',
    businessLine: '研发总部、销售、客户成功',
    countryManager: '陈志强',
    hrDirector: '王晓梅',
    financeLead: '李伟',
    hrEmail: 'hr.cn@hrms.demo',
    handbookVersion: 'CN-v2024.Q4',
    effectiveDate: '2024-10-01',
    lawBasis: '《中华人民共和国劳动法》、《劳动合同法》、《个人信息保护法》',
    payday: '每月 10 日（发放上月工资）',
    inflation: '~0.5%',
    workHours: {
      standard: '09:00 - 18:00',
      lunch: '12:00 - 13:00',
      daily: 8,
      weekly: 40,
      workWeek: '周五',
      lawRef: '《劳动法》第 36 条（每周不超过 40 小时）',
    },
    overtime: {
      weekday: '1.5x',
      weekend: '2.0x',
      holiday: '3.0x',
      monthlyCap: '36 小时/月',
      lawRef: '《劳动法》第 41 条',
    },
    dressCode: '日常 Smart Casual；重要场合商务正装',
    religiousNote: '本公司尊重佛教、道教、伊斯兰教、基督教等多元信仰，重要节日可申请事假。',
    antiBribery: '《中华人民共和国反不正当竞争法》、《刑法》第 163 条（非国家工作人员受贿罪）',
    giftLimit: 'CNY 500',
    harassmentLaw: '《妇女权益保障法》（2023 修订）第 25 条、《民法典》',
    whistleblowerHotline: '+86 21 5888 8888 / ethics@hrms.demo',
    leave: {
      annualMin: 5, annualMax: 15, sick: '医疗期 3-24 个月', maternity: '158 天', paternity: '15 天',
      annualPolicy: '《职工带薪年休假条例》：累计工龄 1-10 年 5 天、10-20 年 10 天、20 年以上 15 天。',
      sickPolicy: '医疗期 3-24 个月（按工龄），期间发放病假工资 60-100%。',
      marriage: '一次性 3 天（部分省市 3-15 天，上海为 10 天）',
      maternityPolicy: '法定 98 天 + 上海生育奖励假 60 天 = 158 天，全额由生育保险报销',
      paternityPolicy: '法定 15 天（上海），由生育保险覆盖',
      maternityLaw: '《女职工劳动保护特别规定》、各省地方法规',
    },
    publicHolidays: [
      { date: '01-01', name: '元旦', note: '' },
      { date: '02-10', name: '春节', note: '7 天 ⭐⭐' },
      { date: '04-04', name: '清明节', note: '3 天' },
      { date: '05-01', name: '劳动节', note: '5 天' },
      { date: '06-10', name: '端午节', note: '3 天' },
      { date: '09-17', name: '中秋节', note: '3 天' },
      { date: '10-01', name: '国庆节', note: '7 天 ⭐' },
    ],
    holidayHighlights: '春节 7 天、国庆 7 天、清明/端午/中秋传统节日',
    holidayCompensation: '春节/国庆通过调休凑成 7 天长假（如周末上班补 1 天）。',
    benefits: {
      insuranceCap: 'CNY 1,000,000', checkupEmp: 800, checkupMgr: 1500, checkupDir: 3000,
      festivalGifts: '春节 + 中秋 + 端午各发 1,000 CNY 节日礼金 + 实物礼盒',
      learning: 5000, fitness: 300,
      specialPerk: '春节红包：员工 1000 / 主管 2000 / 总监 3000 CNY',
    },
    statutoryItems: '五险一金（养老/医疗/失业/工伤/生育 + 住房公积金）/ 个税',
    statutoryBonus: '法律未强制 13 月工资，但市场惯例：春节前发放 1-2 个月年终奖。',
    statutorySystem: '五险一金（按上海标准）',
    statutoryTable: [
      { item: '养老保险', emp: '8%', empr: '16%', note: '退休金' },
      { item: '医疗保险', emp: '2%', empr: '9.5%', note: '医保 + 大病' },
      { item: '失业保险', emp: '0.5%', empr: '0.5%', note: '失业救济' },
      { item: '工伤保险', emp: '0%', empr: '0.16%-1.52%', note: '按行业风险' },
      { item: '生育保险', emp: '0%', empr: '1%', note: '已并入医保' },
      { item: '住房公积金', emp: '7%', empr: '7%', note: '上海标准，可至 12%' },
    ],
    statutoryBase: '社保基数：上海 2024 年下限 7,384 / 上限 36,921 CNY。公积金基数同社保。',
    taxFiling: '国家税务总局 — 公司代扣个税，员工次年 3-6 月在「个人所得税」APP 自助汇算清缴。',
    statutoryPortal: '上海一网通办 (zwdt.sh.gov.cn) / 国家社会保险公共服务平台',
    dataLaw: '《中华人民共和国个人信息保护法》(PIPL) 2021',
    dataLawShort: 'PIPL',
    dataLawDetail: '2021 年 11 月生效，由网信办执行，违规最高罚款 5000 万 CNY 或全球营收 5%。',
    dataRights: ['知情权', '决定权', '查阅权', '复制权', '更正权', '删除权', '可携权（限定）'],
    breachWindow: '立即通知（具体由网信办规定）',
    dpAuthority: '国家互联网信息办公室（网信办）',
    localTools: '钉钉 / 企业微信（IM 备份）、电子税务局 APP',
    itSupport: 'IT 帮助台 +86 21 5888 8000',
    complianceCourseName: '《个人信息保护法》PIPL 合规基础',
    localGuideSummary: '五险一金、个税专项附加扣除、春节假期、年终奖、户籍/居住证。',
    localGuideBody: [
      '## 一、五险一金（上海标准）',
      '- **养老保险**：员工 8%，雇主 16%',
      '- **医疗保险**：员工 2%，雇主 9.5%',
      '- **失业保险**：员工 0.5%，雇主 0.5%',
      '- **工伤保险**：雇主 0.16%-1.52%（按行业）',
      '- **生育保险**：雇主 1%（已并入医保）',
      '- **住房公积金**：员工 7%，雇主 7%（可调至 12%）',
      '',
      '## 二、个税专项附加扣除',
      '7 项专项附加：',
      '- 子女教育（1000 元/月/孩）',
      '- 继续教育（400 元/月）',
      '- 大病医疗（年度据实，上限 80,000）',
      '- 住房贷款利息（1000 元/月）或住房租金（800-1500 元/月）',
      '- 赡养老人（最高 3000 元/月）',
      '- 婴幼儿照护（2000 元/月/孩，2023 新增）',
      '- 由员工在「个人所得税」APP 自行登记',
      '',
      '## 三、年终奖计税',
      '- 可选「合并计税」或「单独计税」（2027 年底前）',
      '- HR 系统提供两种方案对比，自动选最优',
      '',
      '## 四、春节调休',
      '- 春节法定 3 天 + 调休 4 天 = 7 天连休',
      '- 通常前后周末上班补班 2 天',
      '- 调休安排由国务院办公厅每年 11-12 月公布',
      '',
      '## 五、户籍与居住证',
      '- 非沪籍员工建议办理上海居住证（满 7 年可申请上海户口）',
      '- 居住证有助于子女入学、购车摇号',
      '- HR 提供单位居住登记证明',
      '',
      '## 六、外籍员工',
      '外籍员工须办理工作签证 (Z 签) + 工作许可证 + 居留许可。免缴养老险但需缴医保、失业、工伤、生育。',
    ].join('\n'),
  },
};

export function listHandbookCategories(tid) { return bucket(tid).handbookCategories; }
export function listHandbookArticles(tid, { categoryId, q } = {}) {
  let list = bucket(tid).handbookArticles;
  if (categoryId) list = list.filter((a) => a.categoryId === categoryId);
  if (q) {
    const k = q.toLowerCase();
    list = list.filter((a) =>
      a.title.toLowerCase().includes(k) ||
      a.summary.toLowerCase().includes(k) ||
      (a.tags || []).some((t) => t.toLowerCase().includes(k)) ||
      a.body.toLowerCase().includes(k));
  }
  return list;
}
export function getHandbookArticle(tid, id) {
  return bucket(tid).handbookArticles.find((a) => a.id === id);
}
export function markArticleRead(tid, id, employeeId) {
  update(tid, (b) => {
    const a = b.handbookArticles.find((x) => x.id === id);
    if (a && !a.readers.includes(employeeId)) a.readers.push(employeeId);
  });
}

/* ============================================================
 *  TRAINING / LEARNING (培训中心)
 * ============================================================ */
function buildCourses(region) {
  return [
    {
      id: 'crs-onboarding',
      title: '新员工入职培训',
      titleEn: 'Employee Onboarding',
      category: '入职必修',
      level: 'Beginner',
      cover: '🚀',
      coverColor: '#3b63ec',
      duration: 60, // minutes
      instructor: 'HR Team',
      required: true,
      summary: '入职 7 天内必修：公司文化、组织架构、考勤制度、IT 设置、安全合规。',
      lessons: [
        { id: 'l-onb-1', title: '公司介绍与文化', kind: 'reading', duration: 10,
          content: '我们的使命是为东南亚企业提供现代化人力资源平台。核心价值观：客户为先、诚信透明、持续学习、多元包容。\n\n公司目前在 7 个国家设有分公司，员工来自 15+ 文化背景。' },
        { id: 'l-onb-2', title: '考勤与请假制度', kind: 'reading', duration: 10,
          content: '标准工时 09:00-18:00，弹性 ±30 分钟。请假统一在「流程中心」提交。年假按工龄递增：1-3年 14天，3-5年 16天，5年+ 21天。' },
        { id: 'l-onb-3', title: '信息安全红线', kind: 'reading', duration: 15,
          content: '4 条红线：1) 不私自下载客户数据 2) 不在公开渠道发布代码 3) 不用公司设备访问非法网站 4) 离职必须完整交接。违反任一条即终止合同。' },
        { id: 'l-onb-4', title: 'IT 工具上手', kind: 'reading', duration: 10,
          content: '入职第一天激活账号：邮箱、IM、HRMS、文档协同。密码必须 12 位以上，启用 2FA。所有设备开启硬盘加密。' },
        { id: 'l-onb-quiz', title: '入职测验', kind: 'quiz', duration: 15,
          content: '完成下方测验以获取入职证书。',
          quiz: [
            { q: '公司核心价值观中"客户为先"是指什么？',
              options: ['一切决策以客户成功为出发点', '客户永远是对的', '客户优先于员工', '只服务大客户'],
              answer: 0 },
            { q: '入职 30 天内必须完成的事项不包括？',
              options: ['完成必读手册', '与 5 位跨部门同事建立联系', '完成入职培训测验', '获得季度奖金'],
              answer: 3 },
            { q: '信息安全红线行为是？',
              options: ['加班到深夜', '私自下载客户数据库', '请病假', '换部门'],
              answer: 1 },
            { q: '年假规则中，工龄 3-5 年享有多少天？',
              options: ['10', '14', '16', '21'],
              answer: 2 },
            { q: '请假流程在哪里提交？',
              options: ['邮件给 HR', '微信告诉主管', '流程中心 → 请假申请', '口头请假'],
              answer: 2 },
          ],
        },
      ],
    },
    {
      id: 'crs-security',
      title: '信息安全意识',
      titleEn: 'Security Awareness',
      category: '合规必修',
      level: 'Beginner',
      cover: '🔒',
      coverColor: '#ef4444',
      duration: 30,
      instructor: '安全团队',
      required: true,
      summary: '识别钓鱼邮件、密码安全、数据分级、PDPA/GDPR 合规要点。',
      lessons: [
        { id: 'l-sec-1', title: '钓鱼邮件识别', kind: 'reading', duration: 8,
          content: '钓鱼邮件特征：1) 紧迫语气（"24小时内重置密码"）2) 拼写错误的发件人域名 3) 可疑链接（鼠标悬停查看真实 URL）4) 异常附件（.exe / .zip）。遇到请转发到 security@。' },
        { id: 'l-sec-2', title: '密码与 2FA', kind: 'reading', duration: 7,
          content: '密码最低要求：12 位 + 大小写 + 数字 + 特殊字符。强烈推荐使用密码管理器（1Password / Bitwarden）。所有系统必须启用 2FA（首选 TOTP，避免 SMS）。' },
        { id: 'l-sec-3', title: '数据分级与处理', kind: 'reading', duration: 7,
          content: 'P0 机密（客户/薪酬/合同）— 仅授权人员；P1 内部 — 全员可见；P2 公开 — 对外发布。下载 P0 数据需走审批流程。' },
        { id: 'l-sec-quiz', title: '安全测验', kind: 'quiz', duration: 8,
          content: '至少答对 4 题获得证书。',
          quiz: [
            { q: '收到一封声称银行 24 小时内冻结账户的邮件，正确做法是？',
              options: ['立即点击链接重置', '转发到 security@', '回复确认信息', '删除即可'],
              answer: 1 },
            { q: '关于密码，下面哪个说法对？',
              options: ['用生日方便记忆', '使用 12 位以上含特殊字符', '所有系统用同一密码', '写在便签贴显示器'],
              answer: 1 },
            { q: '客户合同属于哪一级数据？',
              options: ['P2 公开', 'P1 内部', 'P0 机密', '无需分级'],
              answer: 2 },
            { q: '2FA 首选哪种方式？',
              options: ['SMS 短信', '邮件验证码', 'TOTP 动态令牌', '安全提示问题'],
              answer: 2 },
            { q: '私自下载客户数据库后果是？',
              options: ['口头警告', '罚款', '终止合同 + 法律追责', '扣绩效'],
              answer: 2 },
          ],
        },
      ],
    },
    {
      id: 'crs-pdpa',
      title: 'PDPA / GDPR 数据合规',
      titleEn: 'Data Privacy Compliance',
      category: '合规必修',
      level: 'Intermediate',
      cover: '⚖️',
      coverColor: '#7c4dff',
      duration: 40,
      instructor: '法务团队',
      required: true,
      summary: '新加坡 PDPA、欧盟 GDPR、印尼 UU PDP、中国 PIPL 核心要点对比。',
      lessons: [
        { id: 'l-pdpa-1', title: 'PDPA 新加坡', kind: 'reading', duration: 10,
          content: 'PDPA 9 大义务：通知、同意、用途限制、准确性、保护、保留限制、转让限制、访问与更正、不主动来电（DNC）。最高罚款 S$1M 或营业额 10%。' },
        { id: 'l-pdpa-2', title: 'GDPR 欧盟', kind: 'reading', duration: 10,
          content: 'GDPR 6 项处理合法依据：同意、合同必需、法律义务、生命利益、公共利益、合法利益。数据主体 8 项权利：访问、更正、删除、限制、可携带、反对、不受自动决策约束、撤回同意。' },
        { id: 'l-pdpa-3', title: '跨境数据传输', kind: 'reading', duration: 10,
          content: '欧盟 → 第三国需 Adequacy Decision 或 SCC 标准合同条款。中国 → 境外需通过 CAC 安全评估或个人信息保护认证。印尼新规要求关键数据本地化存储。' },
        { id: 'l-pdpa-quiz', title: '合规测验', kind: 'quiz', duration: 10,
          content: '5 道题，至少答对 4 题。',
          quiz: [
            { q: 'PDPA 最高罚款是？',
              options: ['S$100K', 'S$500K', 'S$1M 或营业额 10%', '无上限'],
              answer: 2 },
            { q: 'GDPR 数据主体权利不包括？',
              options: ['访问权', '删除权', '可携带权', '匿名分红权'],
              answer: 3 },
            { q: '欧盟向第三国传输数据合法机制是？',
              options: ['用户口头同意', '标准合同条款 SCC', '保密协议', '内部备忘录'],
              answer: 1 },
            { q: '中国 PIPL 对跨境传输的要求？',
              options: ['无要求', '邮件备案', 'CAC 安全评估或认证', '商务部审批'],
              answer: 2 },
            { q: '处理员工敏感数据（如指纹）需要？',
              options: ['口头同意', '主管批准', '明确单独同意 + 必要性论证', '默认即可'],
              answer: 2 },
          ],
        },
      ],
    },
    {
      id: 'crs-leadership',
      title: '管理者必修：1:1 沟通技巧',
      titleEn: 'Effective 1:1 for Managers',
      category: '领导力',
      level: 'Intermediate',
      cover: '👥',
      coverColor: '#10b981',
      duration: 45,
      instructor: 'L&D 团队',
      required: false,
      targetRole: 'manager',
      summary: '如何主持高质量 1:1：议题准备、深度倾听、反馈艺术、心理安全感。',
      lessons: [
        { id: 'l-1on1-1', title: '1:1 的目的与频率', kind: 'reading', duration: 10,
          content: '1:1 的本质是「员工的会议」，不是工作汇报。建议每两周一次，每次 30-45 分钟。地点避免在主管办公室，可选咖啡馆/散步。' },
        { id: 'l-1on1-2', title: '4 类经典问题', kind: 'reading', duration: 12,
          content: '推荐问法：1) 这周最让你 energize 的事？最让你 drained 的事？2) 你现在最大的卡点是什么？3) 如果可以改变一件事，你会改什么？4) 你的职业理想方向？我能怎么帮你？' },
        { id: 'l-1on1-3', title: '反馈的 SBI 模型', kind: 'reading', duration: 10,
          content: 'Situation 情境 + Behavior 行为 + Impact 影响。例："周二的客户会议（S），你打断了客户 3 次（B），导致客户没把核心需求说完，会后他私下表示不满（I）。"' },
        { id: 'l-1on1-quiz', title: '管理者测验', kind: 'quiz', duration: 13,
          content: '4 题，至少答对 3 题。',
          quiz: [
            { q: '1:1 的本质是？',
              options: ['工作汇报', '员工的会议', 'KPI 检查', '布置任务'],
              answer: 1 },
            { q: 'SBI 反馈模型中 I 代表？',
              options: ['Idea 想法', 'Impact 影响', 'Issue 问题', 'Instruction 指示'],
              answer: 1 },
            { q: '员工对 1:1 没什么想说的，最好做法是？',
              options: ['直接结束', '换成工作汇报', '准备 3-4 个开放问题主动引导', '取消下次'],
              answer: 2 },
            { q: '1:1 建议频率？',
              options: ['每月 1 次', '每两周 1 次', '每天 1 次', '只在评审季'],
              answer: 1 },
          ],
        },
      ],
    },
    {
      id: 'crs-sea-culture',
      title: '东南亚跨文化协作',
      titleEn: 'SEA Cross-Cultural Collaboration',
      category: '区域文化',
      level: 'Beginner',
      cover: '🌏',
      coverColor: '#f59e0b',
      duration: 35,
      instructor: 'Regional Team',
      required: false,
      summary: '与印尼、越南、泰国、菲律宾、马来同事高效协作的文化要点。',
      lessons: [
        { id: 'l-sea-1', title: '宗教与饮食禁忌', kind: 'reading', duration: 10,
          content: '印尼/马来：85%+ 穆斯林，斋月期间避免午餐邀约，确认 Halal 标识。泰国：佛教国家，对僧侣保持尊重，触摸头部禁忌。菲律宾：天主教为主，圣诞为最重要节日。越南：祭祖文化，春节 Tết 期间务必尊重家庭团聚。' },
          { id: 'l-sea-2', title: '沟通风格差异', kind: 'reading', duration: 12,
          content: '印尼/泰国：高语境文化，倾向"是是是"避免冲突，需观察非语言信号。越南：直接但礼貌，喜欢面对面而非邮件。菲律宾：英语流利，开放讨论，但"Mañana"时间观念需提前确认 deadline。新加坡：高效务实，可直接给反馈。' },
          { id: 'l-sea-3', title: '节日与时区', kind: 'reading', duration: 8,
          content: 'GMT+7 (印尼/越南/泰国)、GMT+8 (新加坡/马来/菲律宾/中国)。安排会议优先 14:00-17:00 (新加坡时间) 覆盖所有时区。重要节日：Hari Raya (印尼/马来)、Tết (越南)、Songkran (泰国)、屠妖节 (新马印)、农历新年。' },
        { id: 'l-sea-quiz', title: '文化测验', kind: 'quiz', duration: 5,
          content: '答对 3 题以上获得证书。',
          quiz: [
            { q: '与印尼穆斯林同事吃午饭，斋月期间应？',
              options: ['正常邀请', '改到日落后聚餐', '只点 Halal 菜', '强迫他们吃饭'],
              answer: 1 },
            { q: '泰国佛教文化里，禁忌行为是？',
              options: ['脱鞋进入寺庙', '触摸他人头部', '使用泰语问候', '与僧侣保持距离'],
              answer: 1 },
            { q: '安排东南亚跨区会议最佳时段（SGT）？',
              options: ['07:00-09:00', '14:00-17:00', '20:00-22:00', '00:00-02:00'],
              answer: 1 },
            { q: '越南最重要的传统节日是？',
              options: ['圣诞节', 'Tết 春节', '中秋节', '国庆'],
              answer: 1 },
          ],
        },
      ],
    },
    {
      id: 'crs-excel',
      title: 'Excel 数据分析进阶',
      titleEn: 'Excel for Analysts',
      category: '通用技能',
      level: 'Intermediate',
      cover: '📊',
      coverColor: '#06b6d4',
      duration: 50,
      instructor: 'Data Team',
      required: false,
      summary: 'VLOOKUP / XLOOKUP / 数据透视表 / Power Query 基础。',
      lessons: [
        { id: 'l-xl-1', title: 'XLOOKUP 取代 VLOOKUP', kind: 'reading', duration: 12,
          content: 'XLOOKUP(查找值, 查找列, 返回列) — 默认精确匹配，支持反向、找不到时返回默认值。例：=XLOOKUP(A2, 员工表!B:B, 员工表!E:E, "未找到")。' },
        { id: 'l-xl-2', title: '数据透视表实战', kind: 'reading', duration: 18,
          content: '插入 → 数据透视表 → 拖字段到行/列/值/筛选。值字段右键可设置「求和/平均/计数/最大/最小」。切片器 (Slicer) 实现可视化筛选。' },
        { id: 'l-xl-3', title: 'Power Query 入门', kind: 'reading', duration: 15,
          content: '数据 → 获取数据 → 从文件夹/数据库/Web。常用变换：拆分列、合并查询、转置、逆透视、添加自定义列 (M 语言)。刷新时自动重新执行。' },
        { id: 'l-xl-quiz', title: 'Excel 测验', kind: 'quiz', duration: 5,
          content: '3 题，至少答对 2 题。',
          quiz: [
            { q: 'XLOOKUP 相比 VLOOKUP 的最大优势？',
              options: ['更快', '支持反向查找 + 默认值参数', '支持公式', '兼容性更好'],
              answer: 1 },
            { q: '数据透视表的 4 个区域是？',
              options: ['行/列/值/筛选', '上/下/左/右', '主/从/聚合/筛选', '行/列/求和/平均'],
              answer: 0 },
            { q: 'Power Query 的脚本语言是？',
              options: ['VBA', 'M 语言', 'Python', 'SQL'],
              answer: 1 },
          ],
        },
      ],
    },
    // 区域专属合规课程（基于当前租户所在国家）
    buildLocalComplianceCourse(region),
    // 区域专属员工手册测验
    buildHandbookQuizCourse(region),
  ];
}

/* 区域本地合规课程 — 各国不同 */
function buildLocalComplianceCourse(region) {
  const P = REGION_PROFILES[region] || REGION_PROFILES.SG;
  return {
    id: `crs-local-${region.toLowerCase()}`,
    title: `${P.flag} ${P.countryZh}本地合规必修`,
    titleEn: `${P.countryEn} Local Compliance Essentials`,
    category: '本地合规必修',
    level: 'Intermediate',
    cover: '🛡️',
    coverColor: '#0ea5e9',
    duration: 35,
    instructor: `${P.countryZh} HR & Legal`,
    required: true,
    region: P.code,
    summary: `${P.companyName}员工必修：${P.statutorySystem}、${P.dataLawShort}、本地劳动法核心要点。`,
    lessons: [
      { id: `l-lc-${region}-1`, title: `劳动法基础 (${P.countryZh})`, kind: 'reading', duration: 10,
        content: `适用法律：${P.lawBasis}\n\n标准工时：${P.workHours.standard}，每周 ${P.workHours.weekly} 小时 (${P.workHours.lawRef})。\n\n加班费率：工作日 ${P.overtime.weekday}，周末 ${P.overtime.weekend}，法定假日 ${P.overtime.holiday}。月加班上限：${P.overtime.monthlyCap}。\n\n年假：${P.leave.annualPolicy}\n产假：${P.leave.maternityPolicy}\n陪产假：${P.leave.paternityPolicy}` },
      { id: `l-lc-${region}-2`, title: `${P.statutorySystem} 法定缴费`, kind: 'reading', duration: 10,
        content: `${P.statutorySystem} 缴费明细：\n\n${P.statutoryTable.map((s) => `• ${s.item}：员工 ${s.emp} / 雇主 ${s.empr}（${s.note}）`).join('\n')}\n\n基数说明：${P.statutoryBase}\n\n税务申报：${P.taxFiling}\n\n${P.statutoryBonus}` },
      { id: `l-lc-${region}-3`, title: `${P.dataLawShort} 数据隐私`, kind: 'reading', duration: 10,
        content: `**${P.dataLaw}** — ${P.dataLawDetail}\n\n数据主体权利：\n${P.dataRights.map((r) => `• ${r}`).join('\n')}\n\n数据泄露应急：${P.breachWindow}内向 ${P.dpAuthority} 报告。\n\n员工日常责任：客户数据按 P0 分类存储，禁止下载到个人设备；离职前必须完整交接所有访问权限。` },
      { id: `l-lc-${region}-quiz`, title: `${P.countryZh}合规测验`, kind: 'quiz', duration: 5,
        content: `4 题，至少答对 3 题获得「${P.countryZh}本地合规证书」。`,
        quiz: [
          { q: `${P.companyName}所适用的核心劳动法是？`,
            options: [P.lawBasis.split('、')[0], '美国 FLSA', '中国劳动法', '通用国际劳工标准'],
            answer: 0 },
          { q: `${P.statutorySystem.split(' ')[0]} 中，员工方缴费比例最高的是？`,
            options: [P.statutoryTable[0].item, P.statutoryTable[1]?.item || '医保', '失业险', '工伤险'],
            answer: 0 },
          { q: `根据 ${P.dataLawShort}，数据泄露报告窗口是？`,
            options: ['7 天', '30 天', P.breachWindow, '无强制要求'],
            answer: 2 },
          { q: `${P.countryZh}的执法机构是？`,
            options: [P.dpAuthority, 'FBI', 'Interpol', '未指定'],
            answer: 0 },
        ],
      },
    ],
  };
}

/* 员工手册测验 — 基于当前国家手册内容出题 */
function buildHandbookQuizCourse(region) {
  const P = REGION_PROFILES[region] || REGION_PROFILES.SG;
  return {
    id: `crs-handbook-${region.toLowerCase()}`,
    title: `${P.flag} 员工手册测验 (${P.countryZh})`,
    titleEn: `Handbook Comprehension Test (${P.countryEn})`,
    category: '入职必修',
    level: 'Beginner',
    cover: '📚',
    coverColor: '#8b5cf6',
    duration: 20,
    instructor: 'HR Team',
    required: true,
    region: P.code,
    summary: `阅读完 ${P.countryZh}员工手册后参加测验，覆盖工时、假期、薪酬、合规四大模块。`,
    lessons: [
      { id: `l-hb-${region}-1`, title: '阅读指引', kind: 'reading', duration: 5,
        content: `本测验基于《${P.companyName} 员工手册》${P.handbookVersion} 版本（${P.effectiveDate} 生效）。\n\n建议先阅读手册中的 5 篇必读文章：\n1. 欢迎加入 ${P.companyName}\n2. 考勤与工时制度（${P.countryZh}）\n3. 员工行为准则（${P.countryZh}）\n4. 请假规则（${P.countryZh}）\n5. 法定缴费明细（${P.countryZh}）\n\n阅读完毕后开始测验，10 题，至少答对 7 题获得证书。` },
      { id: `l-hb-${region}-quiz`, title: '手册测验', kind: 'quiz', duration: 15,
        content: '10 题，70 分及格。',
        quiz: [
          { q: `${P.companyName}的标准工时是？`,
            options: [P.workHours.standard, '07:00 - 16:00', '10:00 - 19:00', '弹性无固定'],
            answer: 0 },
          { q: `${P.countryZh}每周法定工作小时上限是？`,
            options: ['35 小时', '40 小时', `${P.workHours.weekly} 小时`, '60 小时'],
            answer: 2 },
          { q: `工作日加班费率是？`,
            options: ['1.0x', P.overtime.weekday, '5.0x', '不支付'],
            answer: 1 },
          { q: `年假起始天数为？`,
            options: [`${P.leave.annualMin} 天`, '0 天', '30 天', '50 天'],
            answer: 0 },
          { q: `产假天数为？`,
            options: ['4 周', P.leave.maternity, '0 天', '1 年'],
            answer: 1 },
          { q: `${P.countryZh}的法定缴费体系是？`,
            options: [P.statutorySystem.split(' ')[0], 'IRS', 'NHS', 'TFSA'],
            answer: 0 },
          { q: `${P.statutoryTable[0].item} 员工缴费比例是？`,
            options: ['0%', P.statutoryTable[0].emp, '50%', '100%'],
            answer: 1 },
          { q: `${P.countryZh}的个人数据保护法是？`,
            options: [P.dataLaw, 'GDPR', 'HIPAA', 'CCPA'],
            answer: 0 },
          { q: `礼品/款待的合规上限是？`,
            options: ['无限制', P.giftLimit, '所有礼品禁止', '由员工自行判断'],
            answer: 1 },
          { q: `公司在${P.countryZh}的反贿赂依据法律是？`,
            options: [P.antiBribery, 'FCPA (美国)', 'UK Bribery Act', '内部规章'],
            answer: 0 },
        ],
      },
    ],
  };
}

export function listCourses(tid, filter = {}) {
  let list = bucket(tid).courses;
  if (filter.category) list = list.filter((c) => c.category === filter.category);
  if (filter.required) list = list.filter((c) => c.required);
  if (filter.q) {
    const k = filter.q.toLowerCase();
    list = list.filter((c) =>
      c.title.toLowerCase().includes(k) ||
      (c.titleEn || '').toLowerCase().includes(k) ||
      c.summary.toLowerCase().includes(k));
  }
  return list;
}
export function getCourse(tid, id) {
  return bucket(tid).courses.find((c) => c.id === id);
}
export function getEnrollment(tid, employeeId, courseId) {
  return bucket(tid).enrollments.find((e) => e.employeeId === employeeId && e.courseId === courseId);
}
export function listMyEnrollments(tid, employeeId) {
  return bucket(tid).enrollments.filter((e) => e.employeeId === employeeId);
}
export function enrollCourse(tid, employeeId, courseId) {
  let existing = getEnrollment(tid, employeeId, courseId);
  if (existing) return existing;
  const e = {
    id: `enr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    employeeId, courseId,
    status: 'in_progress',
    completedLessonIds: [],
    score: null,
    enrolledAt: NOW(),
    completedAt: null,
  };
  update(tid, (b) => { b.enrollments.push(e); });
  return e;
}
export function markLessonDone(tid, employeeId, courseId, lessonId) {
  update(tid, (b) => {
    let e = b.enrollments.find((x) => x.employeeId === employeeId && x.courseId === courseId);
    if (!e) {
      e = {
        id: `enr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        employeeId, courseId, status: 'in_progress',
        completedLessonIds: [], score: null,
        enrolledAt: NOW(), completedAt: null,
      };
      b.enrollments.push(e);
    }
    if (!e.completedLessonIds.includes(lessonId)) {
      e.completedLessonIds.push(lessonId);
    }
  });
  return getEnrollment(tid, employeeId, courseId);
}
export function submitQuiz(tid, employeeId, courseId, lessonId, answers) {
  const course = getCourse(tid, courseId);
  const lesson = course?.lessons.find((l) => l.id === lessonId);
  if (!lesson || lesson.kind !== 'quiz' || !lesson.quiz) return null;
  let correct = 0;
  lesson.quiz.forEach((q, i) => { if (answers[i] === q.answer) correct++; });
  const total = lesson.quiz.length;
  const score = Math.round((correct / total) * 100);
  const passed = score >= 70;

  update(tid, (b) => {
    let e = b.enrollments.find((x) => x.employeeId === employeeId && x.courseId === courseId);
    if (!e) {
      e = {
        id: `enr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        employeeId, courseId, status: 'in_progress',
        completedLessonIds: [], score: null,
        enrolledAt: NOW(), completedAt: null,
      };
      b.enrollments.push(e);
    }
    if (passed && !e.completedLessonIds.includes(lessonId)) {
      e.completedLessonIds.push(lessonId);
    }
    // Check if all lessons done
    const allDone = course.lessons.every((l) => e.completedLessonIds.includes(l.id));
    if (allDone && passed) {
      e.status = 'completed';
      e.score = score;
      e.completedAt = NOW();
      // Issue certificate
      const cert = {
        id: `cert-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        employeeId, courseId,
        courseName: course.title,
        score,
        issuedAt: NOW(),
        code: `${course.id.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
      };
      b.certificates.push(cert);
    } else if (passed) {
      e.score = score;
    }
  });
  return { score, total, correct, passed };
}
export function listMyCertificates(tid, employeeId) {
  return bucket(tid).certificates.filter((c) => c.employeeId === employeeId)
    .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
}
