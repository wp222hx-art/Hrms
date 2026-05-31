import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  employeeApi, attendanceApi, leaveApi, expenseApi, payrollApi,
} from '../../mock/api';
import {
  classOf, levelStats, attributesOf, comboOf, comboMultiplier,
  titleOf, coinsOf, dailyQuests, badgesOf, RARITIES,
} from './engine';
import { ensureIdentityCard, tokensOf } from './ledger';
import { UI_ICONS } from './assets';
import Radar from './Radar';
import IdentityCard from './IdentityCard';

const ATTR_ICONS = {
  STA: UI_ICONS.attr_sta, FOC: UI_ICONS.attr_foc, COL: UI_ICONS.attr_col,
  CRE: UI_ICONS.attr_cre, END: UI_ICONS.attr_end, LRN: UI_ICONS.attr_lrn,
};

export default function Lobby() {
  const { session, tenant } = useApp();
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session || !tenant) return;
      const employees = await employeeApi.list(tenant.id);
      const me =
        employees.find((e) => e.email && e.email.toLowerCase() === (session.email || '').toLowerCase()) ||
        employees.find((e) => e.fullName === session.name) ||
        employees[0];
      if (!me) return;

      const [attendance, leaves, expenses, payroll] = await Promise.all([
        attendanceApi.list(tenant.id),
        leaveApi.list(tenant.id),
        expenseApi.list(tenant.id),
        payrollApi.get(tenant.id),
      ]);
      const payslips = (payroll?.lines || []).map((l) => ({ ...l, employeeId: l.employeeId }));

      // Auto-mint identity card if not yet minted
      const identityToken = ensureIdentityCard(tenant.id, me);
      const tokens = tokensOf(tenant.id, me.id);

      if (!cancelled) {
        setData({ me, employees, attendance, leaves, expenses, payslips, identityToken, tokens });
      }
    })();
    return () => { cancelled = true; };
  }, [session, tenant]);

  if (!data) {
    return (
      <div className="fm-loading">
        ◢ LOADING PLAYER DATA ◣
        <div className="fm-loading__bar"><div /></div>
      </div>
    );
  }

  const { me, attendance, leaves, expenses, payslips, identityToken, tokens } = data;
  const cls = classOf(me.department);
  const lvl = levelStats(me, { attendance, leaves });
  const attrs = attributesOf(me);
  const combo = comboOf(me, attendance);
  const comboMul = comboMultiplier(combo);
  const title = titleOf(lvl.level);
  const coins = coinsOf(me, { payslips });
  const quests = dailyQuests(me, { attendance, leaves, expenses });
  const badges = badgesOf(me, { attendance, leaves, expenses, payslips });
  const rewardCount = tokens.filter((t) => t.cardType === 'reward').length;

  const hpMax = 100;
  const hp = Math.round(((me.leaveBalance?.annual || 0) / 14) * hpMax);

  return (
    <>
      {/* === HERO IDENTITY CARD (anime illustration) === */}
      <IdentityCard employee={me} level={lvl.level} token={identityToken} />

      {/* === STATS (EXP / HP / MP / Quick) === */}
      <div className="fm-section fm-section--stats">
        <div className="fm-exp">
          <div className="fm-exp__label">
            <span>EXP</span>
            <span>{lvl.exp} / {lvl.expNeeded}</span>
          </div>
          <div className="fm-bar">
            <div className="fm-bar__fill" style={{ width: `${lvl.expPercent}%` }} />
          </div>
        </div>

        <div className="fm-vitals">
          <div className="fm-vital fm-vital--hp">
            <div className="fm-vital__lbl">
              <span>❤️ HP 体力</span><span>{hp}/{hpMax}</span>
            </div>
            <div className="fm-vital__bar"><div style={{ width: `${hp}%` }} /></div>
          </div>
          <div className="fm-vital fm-vital--mp">
            <div className="fm-vital__lbl">
              <span>💧 MP 精力</span><span>{lvl.expPercent}/100</span>
            </div>
            <div className="fm-vital__bar"><div style={{ width: `${lvl.expPercent}%` }} /></div>
          </div>
        </div>

        <div className="fm-quickstats">
          <div className="fm-quickstat">
            <img className="fm-quickstat__img" src={UI_ICONS.act_combo} alt="" />
            <div className="fm-quickstat__val">{combo}</div>
            <div className="fm-quickstat__lbl">连击</div>
          </div>
          <div className="fm-quickstat">
            <img className="fm-quickstat__img" src={UI_ICONS.act_exp} alt="" />
            <div className="fm-quickstat__val">x{comboMul.mult}</div>
            <div className="fm-quickstat__lbl">倍率</div>
          </div>
          <div className="fm-quickstat">
            <img className="fm-quickstat__img" src={UI_ICONS.tab_cards} alt="" />
            <div className="fm-quickstat__val">{rewardCount}</div>
            <div className="fm-quickstat__lbl">卡牌</div>
          </div>
          <div className="fm-quickstat">
            <img className="fm-quickstat__img" src={UI_ICONS.act_coin} alt="" />
            <div className="fm-quickstat__val">{coins.toLocaleString()}</div>
            <div className="fm-quickstat__lbl">金币</div>
          </div>
        </div>
      </div>

      {/* === ATTRIBUTES === */}
      <div className="fm-section">
        <div className="fm-section__head">
          <div className="fm-section__title">⚔ 角色属性</div>
          <div className="fm-section__more">{title.name}</div>
        </div>
        <div className="fm-radar-wrap">
          <div className="fm-radar">
            <Radar attrs={attrs} size={150} color={cls.color} />
          </div>
          <div className="fm-attrs">
            {['STA','FOC','COL','CRE','END','LRN'].map((k) => (
              <div className="fm-attr" key={k}>
                <img className="fm-attr__icon" src={ATTR_ICONS[k]} alt="" />
                <span className="fm-attr__lbl">{
                  { STA: '体力', FOC: '专注', COL: '协作', CRE: '创造', END: '抗压', LRN: '学习' }[k]
                } {k}</span>
                <span className="fm-attr__val">{attrs[k]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* === DAILY QUESTS === */}
      <div className="fm-section">
        <div className="fm-section__head">
          <div className="fm-section__title">📜 每日任务</div>
          <div className="fm-section__more">
            {quests.filter(q => q.done).length}/{quests.length}
          </div>
        </div>
        {quests.map((q) => (
          <div key={q.id} className={`fm-quest ${q.done ? 'is-done' : ''}`}>
            <div className="fm-quest__icon">{q.icon}</div>
            <div className="fm-quest__body">
              <div className="fm-quest__name">{q.name}</div>
              <div className="fm-quest__reward">{q.reward}</div>
            </div>
            <div className="fm-quest__status">{q.done ? '已完成' : '进行中'}</div>
          </div>
        ))}
      </div>

      {/* === BADGES === */}
      <div className="fm-section">
        <div className="fm-section__head">
          <div className="fm-section__title">🏅 勋章墙</div>
          <div className="fm-section__more">{badges.length} 枚</div>
        </div>
        <div className="fm-badges">
          {badges.map((b) => {
            const r = RARITIES[b.rarity];
            return (
              <div
                key={b.id}
                className="fm-badge"
                style={{ '--b-color': r.color, '--b-glow': r.glow }}
                title={b.desc}
              >
                <div className="fm-badge__emoji">{b.emoji}</div>
                <div className="fm-badge__name">{b.name}</div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
