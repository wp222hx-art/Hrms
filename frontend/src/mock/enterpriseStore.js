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
 * Storage key: `hrms_enterprise_v1`. Per-tenant bucket.
 * All write functions are synchronous; thin async API wrappers live in api.js.
 */

const KEY = 'hrms_enterprise_v1';
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
  const arts = [
    {
      id: 'hb-welcome',
      categoryId: 'hb-cat-welcome',
      title: '欢迎加入我们 · Welcome Onboard',
      summary: '入职第一周必读：公司使命、文化、核心价值观、组织架构概览。',
      tags: ['必读', '入职'],
      mustRead: true,
      body: [
        '## 一、公司使命',
        '我们致力于为东南亚企业提供现代化的人力资源管理平台，让每一位员工都能在工作中获得成长与认可。',
        '',
        '## 二、核心价值观',
        '- **客户为先 (Customer First)** — 一切决策以客户成功为出发点。',
        '- **诚信透明 (Integrity)** — 数据真实、流程透明、责任清晰。',
        '- **持续学习 (Lifelong Learning)** — 每月至少完成一门培训课程。',
        '- **多元包容 (Diversity & Inclusion)** — 尊重不同国家、宗教、语言背景的同事。',
        '',
        '## 三、组织架构',
        '公司目前在新加坡、马来西亚、印尼、越南、泰国、菲律宾、中国设有分公司，按产品线划分为研发部、产品部、销售部、市场部、运营部、客户支持部、人力资源部、财务部。',
        '',
        '## 四、入职 30 天目标',
        '1. 完成所有「必读」手册',
        '2. 完成《新员工入职培训》课程并通过测验',
        '3. 跟直属主管设定第一季度 OKR',
        '4. 至少与 5 位跨部门同事建立联系',
      ].join('\n'),
    },
    {
      id: 'hb-handbook-overview',
      categoryId: 'hb-cat-welcome',
      title: '员工手册总览 · Handbook Overview',
      summary: '员工手册的章节结构、查阅方式、版本更新机制。',
      tags: ['指引'],
      body: [
        '## 如何使用员工手册',
        '员工手册按主题分为 7 大类：公司介绍、行政制度、假期福利、薪酬绩效、信息安全、SEA 区域指南、IT 与工具。',
        '',
        '## 阅读建议',
        '- **必读**（标 ⭐）：入职 7 天内必须阅读并标记已读',
        '- **常用**：日常工作中随时查阅',
        '- **专项**：根据角色和地区针对性阅读',
        '',
        '## 版本更新',
        '手册由 HR 每季度审阅一次，重大更新会以「公告」形式推送。',
      ].join('\n'),
    },
    {
      id: 'hb-attendance-policy',
      categoryId: 'hb-cat-policy',
      title: '考勤与工时制度',
      summary: '标准工时 09:00-18:00，弹性 ±30 分钟，远程办公申请流程。',
      tags: ['必读', '考勤'],
      mustRead: true,
      body: [
        '## 一、标准工时',
        '- 周一至周五 09:00 - 18:00',
        '- 午休时间 12:00 - 13:00（不计入工时）',
        '- 每日有效工时 8 小时',
        '',
        '## 二、弹性工作',
        '- 上下班时间可弹性 ±30 分钟（即最早 08:30 / 最晚 18:30）',
        '- 月度迟到次数不得超过 3 次',
        '- 累计 3 次未打卡视为旷工半天',
        '',
        '## 三、远程办公',
        '- 每月可申请 4 天远程，提前 1 天报备主管',
        '- 跨境出差期间默认远程，不计入额度',
        '',
        '## 四、加班',
        '- 工作日加班需在「流程中心 → 加班申请」提交，主管批准后生效',
        '- 加班时长按 1:1 转换为调休，6 个月内有效',
        '- 法定节假日加班按当地劳动法 2x / 3x 倍率发放',
      ].join('\n'),
    },
    {
      id: 'hb-dress-code',
      categoryId: 'hb-cat-policy',
      title: '着装规范',
      summary: '日常 Smart Casual，客户会议需商务正装，宗教着装受尊重。',
      tags: ['日常'],
      body: [
        '## 日常着装',
        '- 整洁、得体、Smart Casual 即可',
        '- 不允许：拖鞋、过短的短裤、印有不当文字图案的服装',
        '',
        '## 客户会议',
        '- 商务正装：男士衬衫 + 西裤，女士套装或商务连衣裙',
        '- 重要客户接待提前与品牌部确认 dress code',
        '',
        '## 宗教着装',
        '本公司尊重所有员工的宗教着装习惯（如头巾 Hijab、礼拜服等），不得以此为由进行差别对待。',
      ].join('\n'),
    },
    {
      id: 'hb-leave-rules',
      categoryId: 'hb-cat-leave',
      title: '请假规则总览',
      summary: '年假按工龄递增、病假、事假、婚假、产假/陪产假、丧假详细规则。',
      tags: ['必读', '假期'],
      mustRead: true,
      body: [
        '## 一、年假 (Annual Leave)',
        '| 工龄 | 年假天数 |',
        '|---|---|',
        '| < 1 年 | 按月折算（每月 1 天）|',
        '| 1 - 3 年 | 14 天 |',
        '| 3 - 5 年 | 16 天 |',
        '| 5 - 10 年 | 18 天 |',
        '| 10 年以上 | 21 天 |',
        '',
        '## 二、病假 (Sick Leave)',
        '- 每年 14 天带薪病假',
        '- 连续 2 天以上需提供医生证明',
        '',
        '## 三、事假 (Personal Leave)',
        '- 每年 3 天，无薪',
        '- 需提前 1 天向主管申请',
        '',
        '## 四、婚假 (Marriage Leave)',
        '- 一次性 5 天（法定登记日起 6 个月内使用）',
        '',
        '## 五、产假与陪产假',
        '- 产假 16 周（部分国家按当地法律延长）',
        '- 陪产假 7 天',
        '',
        '## 六、丧假 (Bereavement)',
        '- 直系亲属 3 天，旁系 1 天',
        '',
        '## 七、申请流程',
        '所有请假统一在「流程中心 → 请假申请」提交，2 天以内主管审批，3 天以上需部门负责人 + HR 审批。',
      ].join('\n'),
    },
    {
      id: 'hb-benefits',
      categoryId: 'hb-cat-leave',
      title: '员工福利',
      summary: '商业保险、年度体检、节日礼金、生日假、健身补贴、学习基金。',
      tags: ['福利'],
      body: [
        '## 健康保障',
        '- 商业医疗保险（员工 + 1 名直系亲属）',
        '- 年度体检：员工 600 / 主管 1000 / 总监 1500 (当地币)',
        '',
        '## 节日福利',
        '- 春节 / Hari Raya / 圣诞 / 屠妖节 / Tết / Songkran 节日礼金 200',
        '- 中秋 / 端午 实物礼盒',
        '',
        '## 个人成长',
        '- 学习基金：每年 1000（用于课程、书籍、专业认证）',
        '- 健身补贴：每月 100',
        '',
        '## 其他',
        '- 生日当天可申请生日假（半天）',
        '- 入职满 5 年额外奖励 7 天带薪假',
      ].join('\n'),
    },
    {
      id: 'hb-payroll',
      categoryId: 'hb-cat-comp',
      title: '薪酬发放与结构',
      summary: '基本工资 + 绩效奖金 + 福利津贴，每月 25 日发放。',
      tags: ['薪酬'],
      body: [
        '## 薪酬结构',
        '- **基本工资 (Base)**：合同约定',
        '- **绩效奖金 (Bonus)**：季度发放，与个人 + 团队 KPI 挂钩',
        '- **津贴 (Allowance)**：交通 / 通讯 / 餐补',
        '- **法定项 (Statutory)**：按当地法律扣除（CPF / EPF / BPJS / SSS / PhilHealth / SI / SSO 等）',
        '',
        '## 发放日',
        '每月 25 日（如遇周末或公共假期则提前到最近工作日）发放上月工资。',
        '',
        '## 工资条',
        '可在「员工自助 → 我的工资条」查看明细，PDF 下载用于办理签证、贷款等用途。',
        '',
        '## 年终奖',
        '财年结束后第 2 个月发放，金额参考公司业绩 + 个人考评（A=1.5月、B=1月、C=0.5月）。',
      ].join('\n'),
    },
    {
      id: 'hb-perf',
      categoryId: 'hb-cat-comp',
      title: '绩效考评机制',
      summary: 'OKR 季度评审 + 360 度年终评估 + 调薪晋升通道。',
      tags: ['绩效'],
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
        '- 年度调薪窗口：次年 4 月生效',
        '- 晋升评审每年 2 次（4 月 / 10 月）',
        '- P 序列与 M 序列双通道，避免「只有当管理者才能涨工资」',
      ].join('\n'),
    },
    {
      id: 'hb-security',
      categoryId: 'hb-cat-sec',
      title: '信息安全与数据合规',
      summary: 'PDPA / GDPR / 个人信息保护法合规要求，员工日常红线。',
      tags: ['必读', '安全'],
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
        '## 隐私法律',
        '我们的运营受新加坡 PDPA、欧盟 GDPR、中国 个人信息保护法、印尼 UU PDP 共同管辖，所有员工数据处理活动均有审计日志。',
      ].join('\n'),
    },
    {
      id: 'hb-it-tools',
      categoryId: 'hb-cat-it',
      title: 'IT 工具与账号申请',
      summary: '常用 SaaS 工具账号、设备申请、密码重置、报障流程。',
      tags: ['IT'],
      body: [
        '## 标配工具',
        '- 邮箱 (Workspace)、IM、HRMS、工单系统、文档协同、代码仓库',
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
      ].join('\n'),
    },
  ];

  // 区域专属指南
  const seaArticles = {
    ID: {
      id: 'hb-sea-id', title: '🇮🇩 印尼员工指南',
      summary: 'BPJS 社保、个税 PPh 21、斋月工时、Idul Fitri THR 奖金。',
      body: [
        '## 一、社保 BPJS',
        '- BPJS Kesehatan（健康险）：员工 1%，雇主 4%',
        '- BPJS Ketenagakerjaan：JHT 2% + JP 1%（员工部分）',
        '',
        '## 二、个税 PPh 21',
        '- 累进税率 5% / 15% / 25% / 30% / 35%',
        '- 每年由公司代扣代缴，1771-1A 表格年初发放',
        '',
        '## 三、THR 奖金',
        '- Tunjangan Hari Raya — 法定节日奖金',
        '- 工作满 1 年：1 个月工资；不足 1 年按月折算',
        '- 必须在 Idul Fitri 前 7 天发放',
        '',
        '## 四、斋月工作安排',
        '- 工作日缩短 1 小时（08:00 - 16:00）',
        '- 提供晚间开斋餐（Iftar）',
        '- 礼拜空间设于 4 楼东侧',
      ].join('\n'),
    },
    VN: {
      id: 'hb-sea-vn', title: '🇻🇳 越南员工指南',
      summary: 'SI/HI/UI 保险、个税 PIT、Tết 春节奖金、13 月工资。',
      body: [
        '## 一、保险',
        '- Social Insurance (SI)：员工 8%，雇主 17.5%',
        '- Health Insurance (HI)：员工 1.5%，雇主 3%',
        '- Unemployment Insurance (UI)：员工 1%，雇主 1%',
        '',
        '## 二、个税 PIT',
        '累进 5% - 35%，由公司代扣。',
        '',
        '## 三、Tết 春节',
        '- 法定假期 7 天（农历除夕至初六）',
        '- Lương tháng 13（13 月工资）：年终额外发放 1 个月',
        '',
        '## 四、工时',
        '法定每周 48 小时，公司执行 40 小时（周一至周五）。',
      ].join('\n'),
    },
    TH: {
      id: 'hb-sea-th', title: '🇹🇭 泰国员工指南',
      summary: 'SSO 社保、个税 PIT、泼水节 Songkran、佛历假期。',
      body: [
        '## 一、SSO 社保',
        '员工 5%，雇主 5%（封顶月薪 15,000 THB）。',
        '',
        '## 二、个税',
        '累进 0% - 35%，年收入 < 150,000 THB 免税。',
        '',
        '## 三、Songkran 泼水节',
        '4 月 13-15 日，法定假期 3 天。建议在节日期间妥善保管手机等电子设备。',
        '',
        '## 四、佛历假期',
        '万佛节、卫塞节、三宝节等佛历节日为法定假期。',
      ].join('\n'),
    },
    PH: {
      id: 'hb-sea-ph', title: '🇵🇭 菲律宾员工指南',
      summary: 'SSS/PhilHealth/Pag-IBIG 三项法定缴费、13th Month Pay。',
      body: [
        '## 一、法定缴费',
        '- SSS：员工 4.5%，雇主 9.5%',
        '- PhilHealth：员工 2.5%，雇主 2.5%',
        '- Pag-IBIG：员工 2%，雇主 2%',
        '',
        '## 二、13th Month Pay',
        '法律强制，必须在 12 月 24 日前发放，金额 = 全年基本工资 / 12。',
        '',
        '## 三、Service Incentive Leave',
        '工作满 1 年的员工享有 5 天带薪假期（公司年假之外）。',
      ].join('\n'),
    },
    SG: {
      id: 'hb-sea-sg', title: '🇸🇬 新加坡员工指南',
      summary: 'CPF 公积金、税务 IRAS、Work Pass 工准证、Hari Raya/Vesak 假期。',
      body: [
        '## 一、CPF 公积金',
        '- 55 岁以下公民/PR：员工 20%，雇主 17%',
        '- 外籍 EP/SP 持有人：不缴 CPF，按合同薪资全额发放',
        '',
        '## 二、Work Pass',
        '- EP (Employment Pass)：月薪 ≥ S$5,000',
        '- SP (S Pass)：月薪 ≥ S$3,150',
        '- 续签由 HR 在到期前 6 个月启动',
        '',
        '## 三、IRAS 报税',
        '每年 3 月公司代为 e-file IR8A 表格。',
      ].join('\n'),
    },
    MY: {
      id: 'hb-sea-my', title: '🇲🇾 马来西亚员工指南',
      summary: 'EPF/SOCSO/EIS 缴费、个税 PCB、开斋节 Bonus。',
      body: [
        '## 法定缴费',
        '- EPF：员工 11%，雇主 13% (月薪 ≤ RM5000) / 12% (> RM5000)',
        '- SOCSO + EIS：合计 0.7% (员工)',
        '',
        '## PCB 个税',
        '每月预扣，年初汇算清缴 (EA Form)。',
        '',
        '## 节日奖金',
        '开斋节、农历新年、屠妖节各发放节日 Bonus，金额视公司业绩。',
      ].join('\n'),
    },
    CN: {
      id: 'hb-sea-cn', title: '🇨🇳 中国员工指南',
      summary: '五险一金、个税专项附加扣除、年终奖。',
      body: [
        '## 五险一金',
        '养老 8% / 医疗 2% / 失业 0.5% / 工伤 0% / 生育 0% / 公积金 7% （员工部分，城市略有差异）',
        '',
        '## 个税专项附加扣除',
        '子女教育、继续教育、住房贷款利息/租金、赡养老人、大病医疗 — 由员工在个税 APP 自行登记。',
        '',
        '## 年终奖',
        '可选择「合并计税」或「单独计税」，HR 系统提供两种方案对比。',
      ].join('\n'),
    },
  };
  const seaArt = seaArticles[region] || seaArticles.SG;
  arts.push({
    ...seaArt,
    categoryId: 'hb-cat-sea',
    tags: ['必读', 'SEA', region],
    mustRead: true,
  });

  return arts.map((a) => ({
    ...a,
    readers: [],
    updatedAt: today,
    author: 'HR Team',
    pinned: !!a.mustRead,
  }));
}

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
  ];
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
