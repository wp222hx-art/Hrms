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
const DEFAULT_PINNED = ['workflow', 'im', 'attendance', 'leave', 'expense', 'payslip', 'directory', 'announce'];
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
