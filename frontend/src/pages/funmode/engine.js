/**
 * Funmode game engine — turn real HR data into RPG stats.
 * Pure functions, deterministic from input.
 */

/* --------- CLASSES (department → game class) --------- */
export const CLASSES = {
  Engineering: { key: 'mage',      name: '法师',   en: 'Mage',      emoji: '🧙', color: '#7c4dff', desc: '掌握代码与逻辑的奥术之力' },
  Sales:       { key: 'warrior',   name: '战士',   en: 'Warrior',   emoji: '⚔️', color: '#ff5252', desc: '冲锋陷阵·签单破甲' },
  HR:          { key: 'priest',    name: '牧师',   en: 'Priest',    emoji: '💚', color: '#00e676', desc: '团队的治愈与平衡' },
  Design:      { key: 'rogue',     name: '刺客',   en: 'Rogue',     emoji: '🗡️', color: '#ff80ab', desc: '一击致命的美学暗杀' },
  Finance:     { key: 'merchant',  name: '商人',   en: 'Merchant',  emoji: '💰', color: '#ffd54f', desc: '黄金的化身·资源大师' },
  Operations:  { key: 'summoner',  name: '召唤师', en: 'Summoner',  emoji: '🎯', color: '#40c4ff', desc: '统筹千军万马的指挥者' },
  Marketing:   { key: 'bard',      name: '吟游诗人', en: 'Bard',    emoji: '🎤', color: '#e040fb', desc: '声名远扬·万众瞩目' },
  Product:     { key: 'archer',    name: '弓箭手', en: 'Archer',    emoji: '🏹', color: '#26c6da', desc: '远见卓识·精准命中' },
  Default:     { key: 'adventurer', name: '冒险者', en: 'Adventurer', emoji: '🌟', color: '#9e9e9e', desc: '未知的潜力等待觉醒' },
};

export function classOf(dept) {
  return CLASSES[dept] || CLASSES.Default;
}

/* --------- RARITY (used for loot / payslip / badges) --------- */
export const RARITIES = {
  common:    { name: '普通',   en: 'Common',    color: '#9e9e9e', glow: 'rgba(158,158,158,0.4)', stars: 1 },
  uncommon:  { name: '精良',   en: 'Uncommon',  color: '#4caf50', glow: 'rgba(76,175,80,0.5)',   stars: 2 },
  rare:      { name: '稀有',   en: 'Rare',      color: '#2196f3', glow: 'rgba(33,150,243,0.6)',  stars: 3 },
  epic:      { name: '史诗',   en: 'Epic',      color: '#9c27b0', glow: 'rgba(156,39,176,0.7)',  stars: 4 },
  legendary: { name: '传说',   en: 'Legendary', color: '#ff9800', glow: 'rgba(255,152,0,0.8)',   stars: 5 },
  mythic:    { name: '神话',   en: 'Mythic',    color: '#ff1744', glow: 'rgba(255,23,68,0.9)',   stars: 6 },
};

/* Deterministic hash for stable randomness per employee */
function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* --------- LEVEL / EXP --------- */
/**
 * Convert hire date + salary + records into a level.
 * Each year of tenure: +5 levels. Salary tier: +0.01 per currency unit.
 * Each attendance record: +20 EXP. Each approved leave: +50 EXP.
 * Cap at level 99.
 */
export function levelStats(employee, { attendance = [], leaves = [] } = {}) {
  const hire = new Date(employee.hireDate || '2024-01-01');
  const now = new Date();
  const tenureYears = Math.max(0, (now - hire) / (365 * 24 * 3600 * 1000));

  const attCount = attendance.filter((a) => a.employeeId === employee.id).length;
  const leaveCount = leaves.filter((l) => l.employeeId === employee.id && l.status === 'approved').length;

  // Base experience score
  const baseExp = Math.floor(
    tenureYears * 1500 +
    attCount * 22 +
    leaveCount * 60 +
    (employee.baseSalary || employee.monthlyBase || 5000) * 0.08 +
    (hash(employee.id) % 800)
  );

  // Level curve: lvl = floor(sqrt(exp / 80))
  const level = Math.min(99, Math.max(1, Math.floor(Math.sqrt(baseExp / 80))));
  const expForCurrent = level * level * 80;
  const expForNext = (level + 1) * (level + 1) * 80;
  const exp = baseExp - expForCurrent;
  const expNeeded = expForNext - expForCurrent;

  return { level, exp, expNeeded, expPercent: Math.min(100, Math.round((exp / expNeeded) * 100)), totalExp: baseExp };
}

/* --------- 6D ATTRIBUTES (radar) --------- */
/**
 * Six attributes derived deterministically from employee id + department:
 *  - STA  体力       (stamina)
 *  - FOC  专注       (focus)
 *  - COL  协作       (collaboration)
 *  - CRE  创造       (creativity)
 *  - END  抗压       (endurance)
 *  - LRN  学习       (learning)
 * Range 30-99.
 */
export function attributesOf(employee) {
  const h = hash(employee.id);
  const dept = employee.department || 'Default';
  const cls = classOf(dept);

  // Class baseline
  const baselines = {
    mage:       { STA: 50, FOC: 90, COL: 60, CRE: 85, END: 55, LRN: 88 },
    warrior:    { STA: 90, FOC: 60, COL: 80, CRE: 50, END: 88, LRN: 55 },
    priest:     { STA: 60, FOC: 75, COL: 95, CRE: 65, END: 80, LRN: 70 },
    rogue:      { STA: 75, FOC: 85, COL: 50, CRE: 92, END: 60, LRN: 78 },
    merchant:   { STA: 55, FOC: 80, COL: 75, CRE: 60, END: 70, LRN: 85 },
    summoner:   { STA: 65, FOC: 80, COL: 88, CRE: 70, END: 75, LRN: 80 },
    bard:       { STA: 60, FOC: 65, COL: 85, CRE: 90, END: 60, LRN: 72 },
    archer:     { STA: 75, FOC: 92, COL: 70, CRE: 75, END: 70, LRN: 78 },
    adventurer: { STA: 70, FOC: 70, COL: 70, CRE: 70, END: 70, LRN: 70 },
  };
  const base = baselines[cls.key] || baselines.adventurer;

  const jitter = (offset) => ((h >> offset) & 0x1f) - 15; // -15..+16
  const clamp = (v) => Math.max(30, Math.min(99, v));
  return {
    STA: clamp(base.STA + jitter(0)),
    FOC: clamp(base.FOC + jitter(3)),
    COL: clamp(base.COL + jitter(6)),
    CRE: clamp(base.CRE + jitter(9)),
    END: clamp(base.END + jitter(12)),
    LRN: clamp(base.LRN + jitter(15)),
  };
}

/* Combat power: weighted sum, scaled by level */
export function powerOf(employee, lvl) {
  const attr = attributesOf(employee);
  const sum = attr.STA + attr.FOC + attr.COL + attr.CRE + attr.END + attr.LRN;
  return Math.round(sum * (1 + (lvl - 1) * 0.05));
}

/* --------- COMBO (consecutive attendance days) --------- */
export function comboOf(employee, attendance) {
  const mine = attendance
    .filter((a) => a.employeeId === employee.id)
    .map((a) => a.date)
    .sort();
  if (mine.length === 0) return 0;

  let combo = 1;
  for (let i = mine.length - 1; i > 0; i--) {
    const d1 = new Date(mine[i]);
    const d0 = new Date(mine[i - 1]);
    const diff = Math.round((d1 - d0) / 86400000);
    if (diff === 1) combo++;
    else if (diff === 0) continue;
    else break;
  }
  return combo;
}

export function comboMultiplier(combo) {
  if (combo >= 30) return { mult: 5.0, label: '神话连击', en: 'Mythic Streak', color: '#ff1744' };
  if (combo >= 14) return { mult: 3.0, label: '传说连击', en: 'Legendary',     color: '#ff9800' };
  if (combo >= 7)  return { mult: 2.0, label: '史诗连击', en: 'Epic Streak',   color: '#9c27b0' };
  if (combo >= 3)  return { mult: 1.5, label: '稀有连击', en: 'Rare Streak',   color: '#2196f3' };
  return { mult: 1.0, label: '初出茅庐', en: 'Rookie', color: '#9e9e9e' };
}

/* --------- LOOT (payslip → chest rarity) --------- */
export function lootRarity(netPay, baseSalary) {
  if (!baseSalary) return 'common';
  const ratio = netPay / baseSalary;
  if (ratio >= 1.5)  return 'mythic';
  if (ratio >= 1.25) return 'legendary';
  if (ratio >= 1.10) return 'epic';
  if (ratio >= 0.95) return 'rare';
  if (ratio >= 0.80) return 'uncommon';
  return 'common';
}

/* --------- BADGES (achievements) --------- */
export function badgesOf(employee, { attendance = [], leaves = [], expenses = [], payslips = [] } = {}) {
  const list = [];
  const myAtt = attendance.filter((a) => a.employeeId === employee.id);
  const myLeave = leaves.filter((l) => l.employeeId === employee.id);
  const myExp = expenses.filter((e) => e.employeeId === employee.id);
  const myPay = payslips.filter(
    (p) => p.employeeId === employee.employeeId || p.employeeId === employee.id,
  );
  const combo = comboOf(employee, attendance);
  const lateCount = myAtt.filter((a) => a.status === 'LATE').length;

  const push = (id, name, en, rarity, emoji, desc) =>
    list.push({ id, name, en, rarity, emoji, desc });

  // Onboarding
  push('first_step', '初入江湖', 'First Step', 'common', '🌱', '加入公司');

  if (myAtt.length >= 1)
    push('first_clock', '初次打卡', 'First Clock', 'common', '⏰', '完成第一次打卡');
  if (myAtt.length >= 30)
    push('iron_attend', '钢铁出勤', 'Iron Attendance', 'uncommon', '🔩', '累计打卡 30 次');
  if (myAtt.length >= 100)
    push('hundred_clock', '百日精勤', 'Centurion', 'rare', '💯', '累计打卡 100 次');

  if (combo >= 3)
    push('combo_3', '三连击', 'Triple Combo', 'uncommon', '🔥', '连续 3 天打卡');
  if (combo >= 7)
    push('combo_7', '七日传说', 'Seven-Day Saga', 'rare', '⚡', '连续 7 天打卡');
  if (combo >= 14)
    push('combo_14', '半月不灭', 'Fortnight Flame', 'epic', '💎', '连续 14 天打卡');
  if (combo >= 30)
    push('combo_30', '月之守护者', 'Lunar Guardian', 'legendary', '🌙', '连续 30 天打卡');

  if (lateCount === 0 && myAtt.length >= 10)
    push('on_time', '准时之神', 'Punctuality God', 'epic', '⌚', '无迟到记录');

  if (myExp.filter((e) => e.status === 'paid').length >= 5)
    push('expense_5', '账目清零', 'Account Clear', 'uncommon', '🧾', '5 笔报销已结算');

  if (myLeave.filter((l) => l.status === 'approved').length >= 1)
    push('first_leave', '休息也是力量', 'Rest is Power', 'common', '🏖️', '完成首次请假');

  if (myPay.length >= 12)
    push('one_year', '满载一年', 'One Year Strong', 'epic', '🎖️', '在职满 12 个月');

  // Class-specific
  const cls = classOf(employee.department);
  push(`class_${cls.key}`, `${cls.name}觉醒`, `${cls.en} Awakened`, 'rare', cls.emoji, cls.desc);

  // Hidden mythic badge (1/64 chance based on id hash)
  if ((hash(employee.id) & 63) === 7)
    push('chosen_one', '天选之子', 'The Chosen One', 'mythic', '👑', '万中无一的传奇存在');

  return list;
}

/* --------- DAILY QUESTS --------- */
export function dailyQuests(employee, { attendance = [], leaves = [], expenses = [] } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const myToday = attendance.filter((a) => a.employeeId === employee.id && a.date === today);
  const myExp = expenses.filter((e) => e.employeeId === employee.id);
  const myLeave = leaves.filter((l) => l.employeeId === employee.id);

  return [
    {
      id: 'q_clock_in',
      name: '今日上班打卡',
      en: 'Clock in today',
      reward: '+50 EXP · +10 金币',
      done: myToday.some((a) => a.checkIn),
      icon: '🌅',
    },
    {
      id: 'q_clock_out',
      name: '今日下班打卡',
      en: 'Clock out today',
      reward: '+50 EXP · +10 金币',
      done: myToday.some((a) => a.checkOut),
      icon: '🌙',
    },
    {
      id: 'q_submit_exp',
      name: '本周提交 1 笔报销',
      en: 'Submit an expense',
      reward: '+30 EXP',
      done: myExp.length > 0,
      icon: '🧾',
    },
    {
      id: 'q_review_leave',
      name: '查看请假余额',
      en: 'Check leave balance',
      reward: '+10 EXP',
      done: !!employee.leaveBalance,
      icon: '📅',
    },
    {
      id: 'q_no_late',
      name: '本周零迟到',
      en: 'Zero late this week',
      reward: '+100 EXP · 稀有宝箱',
      done: attendance
        .filter((a) => a.employeeId === employee.id)
        .slice(-7)
        .every((a) => a.status !== 'LATE'),
      icon: '🎯',
    },
  ];
}

/* --------- COIN / WALLET (gamified currency) --------- */
export function coinsOf(employee, { payslips = [] } = {}) {
  // payslips lines key is "employeeId" but it's the human-readable code (e.g. SG-0001)
  const myPay = payslips.filter(
    (p) => p.employeeId === employee.employeeId || p.employeeId === employee.id,
  );
  const total = myPay.reduce((sum, p) => sum + (p.net || p.netPay || 0), 0);
  // 1000 of currency = 100 coins (visual only)
  return Math.floor(total / 10);
}

/* --------- TITLE based on level --------- */
export function titleOf(level) {
  if (level >= 80) return { name: '不朽传说', en: 'Immortal Legend', color: '#ff1744' };
  if (level >= 60) return { name: '盖世英雄', en: 'Grand Hero',      color: '#ff9800' };
  if (level >= 40) return { name: '传奇精英', en: 'Elite Legend',    color: '#9c27b0' };
  if (level >= 25) return { name: '资深勇者', en: 'Senior Warrior',  color: '#2196f3' };
  if (level >= 15) return { name: '熟练冒险者', en: 'Skilled Adventurer', color: '#4caf50' };
  if (level >= 5)  return { name: '见习勇者', en: 'Apprentice',      color: '#9e9e9e' };
  return { name: '初心者', en: 'Novice', color: '#bdbdbd' };
}
