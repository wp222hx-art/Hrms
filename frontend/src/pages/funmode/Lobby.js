import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  employeeApi, attendanceApi, leaveApi, expenseApi, payrollApi,
} from '../../mock/api';
import {
  classOf, levelStats, attributesOf, comboOf, comboMultiplier,
  titleOf, coinsOf, dailyQuests, badgesOf, RARITIES,
} from './engine';
import Radar from './Radar';

export default function Lobby() {
  const { session, tenant } = useApp();
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session || !tenant) return;
      const employees = await employeeApi.list(tenant.id);
      // Find the "me" employee — for super_admin / hr_admin who don't map to an
      // employee directly, default to the first one of the tenant.
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

      if (!cancelled) {
        setData({ me, employees, attendance, leaves, expenses, payslips });
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

  const { me, attendance, leaves, expenses, payslips } = data;
  const cls = classOf(me.department);
  const lvl = levelStats(me, { attendance, leaves });
  const attrs = attributesOf(me);
  const combo = comboOf(me, attendance);
  const comboMul = comboMultiplier(combo);
  const title = titleOf(lvl.level);
  const coins = coinsOf(me, { payslips });
  const quests = dailyQuests(me, { attendance, leaves, expenses });
  const badges = badgesOf(me, { attendance, leaves, expenses, payslips });

  // HP = remaining annual leave ratio; MP = exp percent
  const hpMax = 100;
  const hp = Math.round(((me.leaveBalance?.annual || 0) / 14) * hpMax);

  return (
    <>
      {/* HERO CARD */}
      <div className="fm-hero">
        <div className="fm-level">
          <div className="fm-level__lbl">LVL</div>
          <div className="fm-level__num">{lvl.level}</div>
        </div>

        <div className="fm-hero__top">
          <div className="fm-avatar">{cls.emoji}</div>
          <div className="fm-hero__info">
            <h2 className="fm-hero__name">{me.fullName}</h2>
            <span className="fm-hero__title" style={{ color: title.color }}>
              {title.name}
            </span>
            <div className="fm-hero__class">
              <strong style={{ color: cls.color }}>{cls.name}</strong>
              <span style={{ margin: '0 6px' }}>·</span>
              {me.department}
              <span style={{ margin: '0 6px' }}>·</span>
              {me.position || me.jobTitle || '—'}
            </div>
          </div>
        </div>

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
            <div className="fm-quickstat__icon">🔥</div>
            <div className="fm-quickstat__val">{combo}</div>
            <div className="fm-quickstat__lbl">连击</div>
          </div>
          <div className="fm-quickstat">
            <div className="fm-quickstat__icon">⚡</div>
            <div className="fm-quickstat__val">x{comboMul.mult}</div>
            <div className="fm-quickstat__lbl">倍率</div>
          </div>
          <div className="fm-quickstat">
            <div className="fm-quickstat__icon">🏅</div>
            <div className="fm-quickstat__val">{badges.length}</div>
            <div className="fm-quickstat__lbl">勋章</div>
          </div>
          <div className="fm-quickstat">
            <div className="fm-quickstat__icon">💎</div>
            <div className="fm-quickstat__val">{coins.toLocaleString()}</div>
            <div className="fm-quickstat__lbl">金币</div>
          </div>
        </div>
      </div>

      {/* ATTRIBUTES RADAR */}
      <div className="fm-section">
        <div className="fm-section__head">
          <div className="fm-section__title">⚔ 角色属性</div>
        </div>
        <div className="fm-radar-wrap">
          <div className="fm-radar">
            <Radar attrs={attrs} size={150} color={cls.color} />
          </div>
          <div className="fm-attrs">
            <div className="fm-attr"><span className="fm-attr__lbl">体力 STA</span><span className="fm-attr__val">{attrs.STA}</span></div>
            <div className="fm-attr"><span className="fm-attr__lbl">专注 FOC</span><span className="fm-attr__val">{attrs.FOC}</span></div>
            <div className="fm-attr"><span className="fm-attr__lbl">协作 COL</span><span className="fm-attr__val">{attrs.COL}</span></div>
            <div className="fm-attr"><span className="fm-attr__lbl">创造 CRE</span><span className="fm-attr__val">{attrs.CRE}</span></div>
            <div className="fm-attr"><span className="fm-attr__lbl">抗压 END</span><span className="fm-attr__val">{attrs.END}</span></div>
            <div className="fm-attr"><span className="fm-attr__lbl">学习 LRN</span><span className="fm-attr__val">{attrs.LRN}</span></div>
          </div>
        </div>
      </div>

      {/* DAILY QUESTS */}
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

      {/* BADGES */}
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
