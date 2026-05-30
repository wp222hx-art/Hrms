/**
 * Local persistent store for the three new feature hubs:
 *   - Expense receipts (mobile photo / QR scan submissions)
 *   - Training courses + exams + progress
 *   - Welfare events + redemptions (birthday, festival, etc.)
 *
 * Persisted in localStorage. Keyed by tenantId.
 */

const KEY = 'hrms_hub_v1';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
  catch { return {}; }
}
function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* quota */ }
}

function bucket(tenantId) {
  const all = load();
  if (!all[tenantId]) {
    all[tenantId] = {
      receipts: [],
      trainingProgress: {},   // { employeeId: { courseId: { progress, completedAt } } }
      examResults: {},        // { employeeId: [{ examId, score, passedAt }] }
      welfareClaims: [],
      pushHistory: [],        // training push reminders
      posts: [],              // social wall posts
      mentorships: [],        // mentor-apprentice pairs
      events: [],             // OPS-launched campaigns/festivals
      assignments: [],        // OPS-pushed training assignments
    };
    save(all);
  }
  // Backfill any missing keys on legacy buckets
  const b = all[tenantId];
  if (!b.posts)       b.posts = [];
  if (!b.mentorships) b.mentorships = [];
  if (!b.events)      b.events = [];
  if (!b.assignments) b.assignments = [];
  save(all);
  return b;
}
function update(tenantId, mutator) {
  const all = load();
  if (!all[tenantId]) bucket(tenantId);
  mutator(all[tenantId]);
  save(all);
  return all[tenantId];
}

/* ============================================================
 *  RECEIPTS  (expense uploads)
 * ============================================================ */
export function listReceipts(tenantId, employeeId) {
  const b = bucket(tenantId);
  return employeeId
    ? b.receipts.filter((r) => r.employeeId === employeeId)
    : b.receipts;
}

export function addReceipt(tenantId, payload) {
  const id = `rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const receipt = {
    id,
    tenantId,
    status: 'pending',
    submittedAt: new Date().toISOString(),
    ...payload,
  };
  update(tenantId, (b) => { b.receipts.unshift(receipt); });
  return receipt;
}

export function decideReceipt(tenantId, id, decision, note = '') {
  update(tenantId, (b) => {
    const r = b.receipts.find((x) => x.id === id);
    if (r) {
      r.status = decision;
      r.decidedAt = new Date().toISOString();
      r.decisionNote = note;
    }
  });
}

/* ============================================================
 *  QR-CODE simulation
 * ============================================================ */
/**
 * Pretend a quick-scan flow. Returns a fake parsed receipt object that
 * the user can confirm and submit.
 */
export function fakeQrParse() {
  const merchants = [
    { merchant: '京东商城', category: '办公用品', amount: 384.50 },
    { merchant: '滴滴出行', category: '交通',     amount: 56.30 },
    { merchant: '美团商务', category: '餐饮',     amount: 128.00 },
    { merchant: '携程商旅', category: '差旅',     amount: 1620.00 },
    { merchant: '星巴克咖啡', category: '餐饮',  amount: 42.00 },
    { merchant: '高德地图', category: '交通',     amount: 33.50 },
  ];
  const m = merchants[Math.floor(Math.random() * merchants.length)];
  return {
    ...m,
    currency: 'CNY',
    receiptNo: `INV-${Date.now().toString().slice(-8)}`,
    date: new Date().toISOString().slice(0, 10),
    taxRate: '6%',
    source: 'qr_scan',
  };
}

/* ============================================================
 *  TRAINING COURSES (built-in catalog)
 * ============================================================ */
export const TRAINING_COURSES = [
  {
    id: 'onboard_handbook',
    name: '员工手册',
    en: 'Employee Handbook',
    icon: '📘',
    duration: '30 min',
    mandatory: true,
    sections: [
      { id: 's1', title: '公司文化 · 价值观', content: '我们致力于打造一个让每位员工都能发光的环境。核心价值观：诚信、协作、创新、客户至上。' },
      { id: 's2', title: '工作时间 · 出勤制度', content: '标准工时：09:00-18:00 · 弹性 30 分钟。每月迟到不超过 2 次。连续打卡 30 天解锁神话级勋章。' },
      { id: 's3', title: '请假流程', content: '事假/年假/病假需提前 1 天在系统申请，由直属经理审批。年假按工龄递增：1-3年 5天 / 3-5年 10天 / 5年+ 15天。' },
      { id: 's4', title: '报销规则', content: '所有报销需上传发票或二维码扫描凭证。100 元以下当日审批，1000 元以上需总监审批。差旅按公司标准发放。' },
      { id: 's5', title: '行为规范', content: '禁止泄露公司机密 · 保持工作环境整洁 · 尊重同事 · 客户信息严格保密 · 不接受任何形式的回扣。' },
      { id: 's6', title: '福利体系', content: '六险一金 + 补充医疗 + 生日礼金 + 节日福利 + 工龄奖 + 内推奖 + 弹性工作 + 团建预算。' },
    ],
  },
  {
    id: 'security',
    name: '信息安全',
    en: 'Information Security',
    icon: '🛡️',
    duration: '20 min',
    mandatory: true,
    sections: [
      { id: 's1', title: '密码管理', content: '所有账号必须开启二次验证 · 密码至少 12 位 · 不在公共网络处理机密数据。' },
      { id: 's2', title: '数据分类', content: '公开数据 / 内部数据 / 机密数据 / 绝密数据。严格按等级处理。' },
      { id: 's3', title: '钓鱼防范', content: '收到可疑邮件请立即转发至 security@ · 不点击未知链接 · 不下载未知附件。' },
    ],
  },
  {
    id: 'soft_skills',
    name: '沟通与协作',
    en: 'Communication & Collaboration',
    icon: '💬',
    duration: '25 min',
    mandatory: false,
    sections: [
      { id: 's1', title: '高效会议', content: '议程提前发出 · 准时开始结束 · 决议在 24 小时内同步。' },
      { id: 's2', title: '跨部门协作', content: '主动沟通 · 文档先行 · 异议明确 · 决策落地。' },
      { id: 's3', title: '冲突处理', content: '面向问题不面向人 · 多用 I-statement · 寻求共赢方案。' },
    ],
  },
];

export const EXAMS = [
  {
    id: 'exam_onboard',
    courseId: 'onboard_handbook',
    name: '入职考试 · 员工手册',
    passScore: 60,
    questions: [
      {
        id: 'q1',
        q: '标准工作时间是？',
        options: ['08:00-17:00', '09:00-18:00', '10:00-19:00', '不固定'],
        answer: 1,
      },
      {
        id: 'q2',
        q: '所有报销需要提供什么凭证？',
        options: ['口头说明即可', '发票或二维码扫描', '只需金额', '同事证明'],
        answer: 1,
      },
      {
        id: 'q3',
        q: '工龄 3-5 年员工年假天数？',
        options: ['5 天', '10 天', '15 天', '20 天'],
        answer: 1,
      },
      {
        id: 'q4',
        q: '收到可疑钓鱼邮件应该？',
        options: ['立即回复', '转发同事', '点击链接看看', '转发到 security@ 并不点击'],
        answer: 3,
      },
      {
        id: 'q5',
        q: '哪一项不属于公司核心价值观？',
        options: ['诚信', '客户至上', '加班至上', '协作'],
        answer: 2,
      },
    ],
  },
];

export function startCourse(tenantId, employeeId, courseId) {
  update(tenantId, (b) => {
    if (!b.trainingProgress[employeeId]) b.trainingProgress[employeeId] = {};
    if (!b.trainingProgress[employeeId][courseId]) {
      b.trainingProgress[employeeId][courseId] = {
        startedAt: new Date().toISOString(),
        progress: 0,
        completedSections: [],
      };
    }
  });
}

export function markSectionRead(tenantId, employeeId, courseId, sectionId) {
  update(tenantId, (b) => {
    if (!b.trainingProgress[employeeId]) b.trainingProgress[employeeId] = {};
    let prog = b.trainingProgress[employeeId][courseId];
    if (!prog) {
      prog = b.trainingProgress[employeeId][courseId] = {
        startedAt: new Date().toISOString(),
        progress: 0,
        completedSections: [],
      };
    }
    if (!prog.completedSections.includes(sectionId)) {
      prog.completedSections.push(sectionId);
    }
    const course = TRAINING_COURSES.find((c) => c.id === courseId);
    if (course) {
      prog.progress = Math.round((prog.completedSections.length / course.sections.length) * 100);
      if (prog.progress === 100 && !prog.completedAt) {
        prog.completedAt = new Date().toISOString();
      }
    }
  });
}

export function courseProgress(tenantId, employeeId, courseId) {
  const b = bucket(tenantId);
  return b.trainingProgress?.[employeeId]?.[courseId] || { progress: 0, completedSections: [] };
}

export function allTrainingProgress(tenantId, employeeId) {
  const b = bucket(tenantId);
  return b.trainingProgress?.[employeeId] || {};
}

export function submitExam(tenantId, employeeId, examId, answers) {
  const exam = EXAMS.find((e) => e.id === examId);
  if (!exam) return { error: 'exam_not_found' };
  let correct = 0;
  exam.questions.forEach((q, idx) => {
    if (answers[idx] === q.answer) correct++;
  });
  const score = Math.round((correct / exam.questions.length) * 100);
  const passed = score >= exam.passScore;
  const result = {
    examId,
    score,
    correct,
    total: exam.questions.length,
    passed,
    submittedAt: new Date().toISOString(),
    answers,
  };
  update(tenantId, (b) => {
    if (!b.examResults[employeeId]) b.examResults[employeeId] = [];
    b.examResults[employeeId].push(result);
  });
  return result;
}

export function examResults(tenantId, employeeId) {
  const b = bucket(tenantId);
  return b.examResults?.[employeeId] || [];
}

/* ============================================================
 *  WELFARE / BENEFITS
 * ============================================================ */
export const WELFARE_CATALOG = [
  { id: 'birthday',    icon: '🎂', name: '生日福利', en: 'Birthday Gift',   value: '¥500 礼金 + 半天假', period: 'monthly',  cardKey: 'birthday',  rarity: 'epic' },
  { id: 'spring_fest', icon: '🧧', name: '春节红包', en: 'Spring Festival', value: '¥2000 红包',        period: 'yearly',   cardKey: 'festival', rarity: 'legendary' },
  { id: 'mid_autumn',  icon: '🥮', name: '中秋月饼', en: 'Mid-Autumn',      value: '¥800 月饼券',       period: 'yearly',   cardKey: 'festival', rarity: 'rare' },
  { id: 'team_build',  icon: '🎮', name: '团建预算', en: 'Team Building',   value: '¥300/人/季度',     period: 'quarterly',cardKey: 'teamwork', rarity: 'uncommon' },
  { id: 'health',      icon: '🩺', name: '年度体检', en: 'Annual Checkup',  value: '高端体检套餐',     period: 'yearly',   cardKey: 'perfect',  rarity: 'epic' },
  { id: 'referral',    icon: '🤝', name: '内推奖金', en: 'Referral Bonus',  value: '¥5000/人',         period: 'event',    cardKey: 'teamwork', rarity: 'rare' },
  { id: 'tenure_1y',   icon: '🎖️', name: '满 1 年纪念', en: '1-Year',         value: '¥1000 + 纪念礼品', period: 'event',    cardKey: 'champion', rarity: 'epic' },
  { id: 'tenure_3y',   icon: '🏆', name: '满 3 年纪念', en: '3-Year',         value: '¥3000 + 5 天假',  period: 'event',    cardKey: 'champion', rarity: 'legendary' },
  { id: 'edu_subsidy', icon: '📚', name: '学习补贴', en: 'Edu Subsidy',     value: '¥3000/年',         period: 'yearly',   cardKey: 'inspiration', rarity: 'rare' },
  { id: 'flex_work',   icon: '🏖️', name: '弹性工作', en: 'Flex Work',       value: '远程办公 4天/月',  period: 'monthly',  cardKey: 'inspiration', rarity: 'uncommon' },
];

export function listWelfareClaims(tenantId, employeeId) {
  const b = bucket(tenantId);
  return employeeId
    ? b.welfareClaims.filter((w) => w.employeeId === employeeId)
    : b.welfareClaims;
}

export function claimWelfare(tenantId, employee, welfareId) {
  const w = WELFARE_CATALOG.find((x) => x.id === welfareId);
  if (!w) return null;
  // Check if already claimed in current period
  const b = bucket(tenantId);
  const existing = b.welfareClaims.find(
    (c) => c.employeeId === employee.id && c.welfareId === welfareId
       && periodKey(w.period) === c.periodKey,
  );
  if (existing) return { existing: true, claim: existing };

  const claim = {
    id: `wlf-${Date.now()}`,
    tenantId,
    employeeId: employee.id,
    welfareId,
    welfareName: w.name,
    value: w.value,
    claimedAt: new Date().toISOString(),
    periodKey: periodKey(w.period),
    status: 'redeemed',
  };
  update(tenantId, (b2) => { b2.welfareClaims.unshift(claim); });
  return { existing: false, claim, welfare: w };
}

function periodKey(period) {
  const d = new Date();
  if (period === 'monthly')   return `${d.getFullYear()}-${d.getMonth()+1}`;
  if (period === 'quarterly') return `${d.getFullYear()}-Q${Math.floor(d.getMonth()/3)+1}`;
  if (period === 'yearly')    return `${d.getFullYear()}`;
  return 'once';
}

/**
 * Detect upcoming welfare opportunities for the employee
 * (birthday this month, tenure milestone, festival in next 30 days).
 */
export function detectWelfareTriggers(employee) {
  const triggers = [];
  const today = new Date();

  if (employee.dateOfBirth || employee.birthday) {
    const b = new Date(employee.dateOfBirth || employee.birthday);
    if (b.getMonth() === today.getMonth()) {
      triggers.push({ id: 'birthday', urgency: 'high', label: '本月生日 · 立即领取生日福利' });
    }
  }
  if (employee.hireDate) {
    const h = new Date(employee.hireDate);
    const years = (today - h) / (365 * 24 * 3600 * 1000);
    if (years >= 1 && years < 1.05) triggers.push({ id: 'tenure_1y', urgency: 'high', label: '入职满 1 年 · 解锁纪念福利' });
    if (years >= 3 && years < 3.05) triggers.push({ id: 'tenure_3y', urgency: 'high', label: '入职满 3 年 · 解锁纪念福利' });
  }
  // Festival window detection (春节/中秋 mocked as upcoming)
  const m = today.getMonth() + 1;
  if (m === 1 || m === 2)   triggers.push({ id: 'spring_fest', urgency: 'medium', label: '春节季 · 红包待领取' });
  if (m === 8 || m === 9)   triggers.push({ id: 'mid_autumn',  urgency: 'medium', label: '中秋季 · 月饼券待领取' });

  return triggers;
}

/* ============================================================
 *  SOCIAL WALL (posts / likes / cheers)
 * ============================================================ */
export const POST_KINDS = [
  { id: 'cheer',    icon: '📣', label: '喊话',   color: '#ff2ec8' },
  { id: 'birthday', icon: '🎂', label: '生日祝福', color: '#ffb74d' },
  { id: 'thanks',   icon: '🙏', label: '感谢',   color: '#26c6da' },
  { id: 'gossip',   icon: '🍵', label: '吐槽',   color: '#ab47bc' },
  { id: 'praise',   icon: '🏆', label: '表扬',   color: '#ffd54f' },
  { id: 'event',    icon: '🎉', label: '动态',   color: '#42a5f5' },
];

export function listPosts(tenantId, { limit = 50 } = {}) {
  const b = bucket(tenantId);
  return [...b.posts]
    .sort((a, b2) => new Date(b2.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

export function addPost(tenantId, payload) {
  const post = {
    id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    tenantId,
    kind: 'cheer',
    text: '',
    likes: [],
    comments: [],
    pinned: false,
    createdAt: new Date().toISOString(),
    ...payload,
  };
  update(tenantId, (b) => { b.posts.unshift(post); });
  return post;
}

export function likePost(tenantId, postId, employeeId) {
  let after = null;
  update(tenantId, (b) => {
    const p = b.posts.find((x) => x.id === postId);
    if (!p) return;
    if (!p.likes) p.likes = [];
    const idx = p.likes.indexOf(employeeId);
    if (idx >= 0) p.likes.splice(idx, 1);
    else p.likes.push(employeeId);
    after = p;
  });
  return after;
}

export function commentPost(tenantId, postId, comment) {
  update(tenantId, (b) => {
    const p = b.posts.find((x) => x.id === postId);
    if (!p) return;
    if (!p.comments) p.comments = [];
    p.comments.push({
      id: `cm-${Date.now()}`,
      ...comment,
      at: new Date().toISOString(),
    });
  });
}

export function pinPost(tenantId, postId, pinned) {
  update(tenantId, (b) => {
    const p = b.posts.find((x) => x.id === postId);
    if (p) p.pinned = !!pinned;
  });
}

export function removePost(tenantId, postId) {
  update(tenantId, (b) => {
    b.posts = b.posts.filter((p) => p.id !== postId);
  });
}

/**
 * Total likes received by the employee on his/her own posts.
 */
export function popularityOf(tenantId, employeeId) {
  const b = bucket(tenantId);
  let total = 0;
  let posts = 0;
  b.posts.forEach((p) => {
    if (p.authorId === employeeId) {
      total += (p.likes?.length || 0);
      posts += 1;
    }
  });
  return { likes: total, posts };
}

/* ============================================================
 *  MENTOR / APPRENTICE PAIRS
 * ============================================================ */
export const MENTOR_SKILLS = [
  '业务流程', '系统使用', '客户沟通', '团队协作',
  '产品知识', '行业经验', '代码规范', '汇报演讲',
];

export function listMentorships(tenantId, { employeeId } = {}) {
  const b = bucket(tenantId);
  if (!employeeId) return b.mentorships;
  return b.mentorships.filter(
    (m) => m.mentorId === employeeId || m.apprenticeId === employeeId,
  );
}

export function createMentorship(tenantId, { mentorId, mentorName, apprenticeId, apprenticeName, skills = [], goal = '' }) {
  const existing = bucket(tenantId).mentorships.find(
    (m) => m.mentorId === mentorId && m.apprenticeId === apprenticeId && m.status === 'active',
  );
  if (existing) return { existing: true, pair: existing };
  const pair = {
    id: `mt-${Date.now()}`,
    tenantId,
    mentorId,
    mentorName,
    apprenticeId,
    apprenticeName,
    skills,
    goal,
    status: 'active',
    progress: 0,
    milestones: [],
    createdAt: new Date().toISOString(),
  };
  update(tenantId, (b) => { b.mentorships.unshift(pair); });
  return { existing: false, pair };
}

export function logMentorMilestone(tenantId, pairId, milestone) {
  let updated = null;
  update(tenantId, (b) => {
    const m = b.mentorships.find((x) => x.id === pairId);
    if (!m) return;
    if (!m.milestones) m.milestones = [];
    m.milestones.push({
      id: `ms-${Date.now()}`,
      text: milestone.text || '',
      at: new Date().toISOString(),
      by: milestone.by || 'mentor',
    });
    // 5 milestones = graduation
    m.progress = Math.min(100, m.milestones.length * 20);
    if (m.progress >= 100 && m.status === 'active') {
      m.status = 'graduated';
      m.graduatedAt = new Date().toISOString();
    }
    updated = m;
  });
  return updated;
}

export function graduateMentorship(tenantId, pairId) {
  let updated = null;
  update(tenantId, (b) => {
    const m = b.mentorships.find((x) => x.id === pairId);
    if (m && m.status === 'active') {
      m.status = 'graduated';
      m.progress = 100;
      m.graduatedAt = new Date().toISOString();
      updated = m;
    }
  });
  return updated;
}

/* ============================================================
 *  OPS EVENTS / CAMPAIGNS (HR-launched)
 * ============================================================ */
export const EVENT_TEMPLATES = [
  { id: 'spring',     icon: '🧧', name: '春节红包派发',  rewardCard: 'festival', defaultValue: '¥2000 红包' },
  { id: 'mid',        icon: '🥮', name: '中秋月饼券',    rewardCard: 'festival', defaultValue: '¥800 月饼券' },
  { id: 'birthday',   icon: '🎂', name: '本月生日会',    rewardCard: 'birthday', defaultValue: '¥500 + 半天假' },
  { id: 'anniv',      icon: '🎉', name: '公司周年庆',    rewardCard: 'festival', defaultValue: '¥1000 周年礼包' },
  { id: 'champion',   icon: '🏆', name: '季度战神评选',  rewardCard: 'champion', defaultValue: '神话级冠军卡' },
  { id: 'innovation', icon: '💡', name: '创新挑战赛',    rewardCard: 'inspiration', defaultValue: '¥2000 + 灵感卡' },
];

export function listEvents(tenantId) {
  const b = bucket(tenantId);
  return [...b.events].sort(
    (a, b2) => new Date(b2.createdAt) - new Date(a.createdAt),
  );
}

export function createEvent(tenantId, payload) {
  const ev = {
    id: `evt-${Date.now()}`,
    tenantId,
    name: '',
    description: '',
    rewardCard: 'festival',
    value: '',
    status: 'active',
    participants: [], // employeeIds who claimed
    createdAt: new Date().toISOString(),
    ...payload,
  };
  update(tenantId, (b) => { b.events.unshift(ev); });
  return ev;
}

export function joinEvent(tenantId, eventId, employeeId) {
  let result = null;
  update(tenantId, (b) => {
    const ev = b.events.find((x) => x.id === eventId);
    if (!ev) return;
    if (ev.status !== 'active') { result = { error: 'closed' }; return; }
    if (ev.participants.includes(employeeId)) { result = { error: 'joined' }; return; }
    ev.participants.push(employeeId);
    result = { ok: true, event: ev };
  });
  return result;
}

export function closeEvent(tenantId, eventId) {
  update(tenantId, (b) => {
    const ev = b.events.find((x) => x.id === eventId);
    if (ev) ev.status = 'closed';
  });
}

/* ============================================================
 *  OPS TRAINING ASSIGNMENTS
 * ============================================================ */
export function listAssignments(tenantId, { employeeId } = {}) {
  const b = bucket(tenantId);
  if (!employeeId) return b.assignments;
  return b.assignments.filter(
    (a) => a.targets === 'all' || (Array.isArray(a.targetIds) && a.targetIds.includes(employeeId)),
  );
}

export function createAssignment(tenantId, payload) {
  const a = {
    id: `asn-${Date.now()}`,
    tenantId,
    courseId: '',
    targets: 'all',       // 'all' | 'select'
    targetIds: [],
    dueDate: null,
    createdAt: new Date().toISOString(),
    ...payload,
  };
  update(tenantId, (b) => { b.assignments.unshift(a); });
  return a;
}

/* ============================================================
 *  OPS-side aggregated stats (for HR console)
 * ============================================================ */
export function opsStats(tenantId) {
  const b = bucket(tenantId);
  return {
    receiptsPending: b.receipts.filter((r) => r.status === 'pending').length,
    receiptsTotal:   b.receipts.length,
    welfareGiven:    b.welfareClaims.length,
    activeEvents:    b.events.filter((e) => e.status === 'active').length,
    totalEvents:     b.events.length,
    posts:           b.posts.length,
    mentorships:     b.mentorships.filter((m) => m.status === 'active').length,
    graduations:     b.mentorships.filter((m) => m.status === 'graduated').length,
    assignments:     b.assignments.length,
  };
}

