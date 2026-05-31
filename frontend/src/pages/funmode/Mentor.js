import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { employeeApi } from '../../mock/api';
import { UI_ICONS } from './assets';
import {
  MENTOR_SKILLS, listMentorships, createMentorship,
  logMentorMilestone, graduateMentorship,
} from './hubStore';
import { mintCard, tokensOf } from './ledger';
import MintModal from './MintModal';

/**
 * Mentor / Apprentice system.
 *  - As a mentor: bind to an apprentice, log milestones, graduate.
 *  - As an apprentice: see your mentor & progress.
 *  - On graduation: both sides receive a 'mentor' (legendary) NFT.
 */
export default function Mentor() {
  const { session, tenant } = useApp();
  const [me, setMe] = useState(null);
  const [emps, setEmps] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [view, setView] = useState('list'); // list | new | detail
  const [activePair, setActivePair] = useState(null);
  const [milestoneText, setMilestoneText] = useState('');
  const [mint, setMint] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(null), 1800); };

  // form state
  const [form, setForm] = useState({
    apprenticeId: '',
    skills: [],
    goal: '',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tenant) return;
      const list = await employeeApi.list(tenant.id);
      const found =
        list.find((e) => e.email && e.email.toLowerCase() === (session?.email || '').toLowerCase()) ||
        list.find((e) => e.fullName === session?.name) ||
        list[0];
      if (!cancelled) {
        setEmps(list);
        setMe(found);
        setPairs(listMentorships(tenant.id, { employeeId: found.id }));
      }
    })();
    return () => { cancelled = true; };
  }, [tenant, session]);

  const refresh = () => {
    if (!me || !tenant) return;
    setPairs(listMentorships(tenant.id, { employeeId: me.id }));
  };

  const mintMentorCard = (employeeId, employeeName, meta) => {
    const tokens = tokensOf(tenant.id, employeeId);
    const already = tokens.some((t) => t.cardKey === 'mentor' && t.meta?.pairId === meta.pairId);
    if (already) return null;
    return mintCard({
      tenantId: tenant.id,
      employeeId,
      employeeName,
      cardType: 'reward',
      cardKey: 'mentor',
      rarity: 'legendary',
      meta: { source: 'mentor', date: new Date().toISOString().slice(0, 10), ...meta },
    });
  };

  const handleCreate = () => {
    if (!form.apprenticeId || form.apprenticeId === me.id) {
      showToast('请选择一位徒弟（不能是自己）');
      return;
    }
    const app = emps.find((e) => e.id === form.apprenticeId);
    if (!app) return;
    const res = createMentorship(tenant.id, {
      mentorId: me.id,
      mentorName: me.fullName,
      apprenticeId: app.id,
      apprenticeName: app.fullName,
      skills: form.skills,
      goal: form.goal.trim(),
    });
    if (res.existing) {
      showToast('已经存在结对关系');
      return;
    }
    setForm({ apprenticeId: '', skills: [], goal: '' });
    setView('list');
    refresh();
    showToast('✅ 师徒结对成功');
  };

  const handleLogMilestone = () => {
    if (!milestoneText.trim() || !activePair) return;
    const after = logMentorMilestone(tenant.id, activePair.id, {
      text: milestoneText.trim(),
      by: activePair.mentorId === me.id ? 'mentor' : 'apprentice',
    });
    setMilestoneText('');
    if (after?.status === 'graduated' && after.graduatedAt) {
      onGraduate(after);
    } else {
      setActivePair(after);
      refresh();
      showToast('🎯 里程碑已记录');
    }
  };

  const handleGraduate = () => {
    if (!activePair) return;
    if (!window.confirm('确认让徒弟出师？双方将获得师承传承传说级 NFT')) return;
    const after = graduateMentorship(tenant.id, activePair.id);
    if (after) onGraduate(after);
  };

  const onGraduate = (pair) => {
    // Mint for mentor
    const tokenMentor = mintMentorCard(pair.mentorId, pair.mentorName, {
      pairId: pair.id, role: 'mentor', counterpart: pair.apprenticeName,
    });
    // Mint for apprentice
    mintMentorCard(pair.apprenticeId, pair.apprenticeName, {
      pairId: pair.id, role: 'apprentice', counterpart: pair.mentorName,
    });
    // Show mint animation for whichever side I am
    const myToken = pair.mentorId === me.id ? tokenMentor : tokensOf(tenant.id, me.id)
      .find((t) => t.cardKey === 'mentor' && t.meta?.pairId === pair.id);
    if (myToken) setTimeout(() => setMint({ token: myToken }), 200);
    setActivePair(pair);
    refresh();
  };

  if (!me) {
    return (
      <div className="fm-loading">
        ◢ LOADING DOJO ◣
        <div className="fm-loading__bar"><div /></div>
      </div>
    );
  }

  const asMentor      = pairs.filter((p) => p.mentorId === me.id);
  const asApprentice  = pairs.filter((p) => p.apprenticeId === me.id);
  const activeCount   = pairs.filter((p) => p.status === 'active').length;
  const gradCount     = pairs.filter((p) => p.status === 'graduated').length;

  return (
    <>
      {toast && <div className="fm-toast">{toast}</div>}
      <MintModal open={!!mint} token={mint?.token} onClose={() => setMint(null)} />

      {/* Header */}
      <div className="fm-section fm-mentor-hero">
        <div className="fm-expense-hero__top">
          <img src={UI_ICONS.ic_pair} alt="" className="fm-expense-hero__icon" />
          <div>
            <div className="fm-expense-hero__title">师徒道场 · Mentor Dojo</div>
            <div className="fm-expense-hero__sub">绑定 · 传承 · 出师 · 传说级双卡铸造</div>
          </div>
        </div>
        <div className="fm-expense-hero__stats">
          <div className="fm-expense-hero__stat">
            <div className="fm-expense-hero__stat-val">{asMentor.length}</div>
            <div className="fm-expense-hero__stat-lbl">带过的徒弟</div>
          </div>
          <div className="fm-expense-hero__stat">
            <div className="fm-expense-hero__stat-val">{asApprentice.length}</div>
            <div className="fm-expense-hero__stat-lbl">拜过的师父</div>
          </div>
          <div className="fm-expense-hero__stat">
            <div className="fm-expense-hero__stat-val">{gradCount}</div>
            <div className="fm-expense-hero__stat-lbl">已出师</div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      {view === 'list' && (
        <div className="fm-section">
          <div className="fm-section__head">
            <div className="fm-section__title">🤝 我的结对</div>
            <button className="fm-mini" onClick={() => setView('new')}>+ 新建师徒</button>
          </div>
          {pairs.length === 0 && (
            <div className="fm-empty">
              暂无结对关系 — 点击右上「+ 新建师徒」收徒，或等师父来找你 🎴
            </div>
          )}
          <div className="fm-pair-list">
            {pairs.map((p) => {
              const role = p.mentorId === me.id ? 'mentor' : 'apprentice';
              const counterpart = role === 'mentor' ? p.apprenticeName : p.mentorName;
              return (
                <div
                  key={p.id}
                  className={`fm-pair ${p.status === 'graduated' ? 'is-grad' : ''}`}
                  onClick={() => { setActivePair(p); setView('detail'); }}
                >
                  <div className="fm-pair__role">
                    {role === 'mentor' ? '🧙 师父视角' : '🧑‍🎓 徒弟视角'}
                  </div>
                  <div className="fm-pair__title">
                    {p.mentorName} <span className="fm-pair__arr">▸</span> {p.apprenticeName}
                  </div>
                  <div className="fm-pair__skills">
                    {(p.skills || []).map((s) => (
                      <span key={s} className="fm-tag">{s}</span>
                    ))}
                  </div>
                  <div className="fm-pair__bar">
                    <div style={{ width: `${p.progress || 0}%` }} />
                  </div>
                  <div className="fm-pair__foot">
                    <span>{p.status === 'graduated' ? '🏆 已出师' : '修行中'}</span>
                    <span>{(p.milestones || []).length} 里程碑 · {p.progress || 0}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* New pair form */}
      {view === 'new' && (
        <div className="fm-section">
          <div className="fm-section__head">
            <div className="fm-section__title">+ 收徒 · 新建师徒关系</div>
            <button className="fm-link" onClick={() => setView('list')}>← 返回</button>
          </div>
          <div className="fm-formgrid">
            <div className="fm-field fm-field--full">
              <label>选择徒弟</label>
              <select
                value={form.apprenticeId}
                onChange={(e) => setForm({ ...form, apprenticeId: e.target.value })}
              >
                <option value="">-- 选择员工 --</option>
                {emps.filter((e) => e.id !== me.id).map((e) => (
                  <option key={e.id} value={e.id}>{e.fullName} · {e.department}</option>
                ))}
              </select>
            </div>
            <div className="fm-field fm-field--full">
              <label>传承技能（多选）</label>
              <div className="fm-chips">
                {MENTOR_SKILLS.map((s) => {
                  const on = form.skills.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`fm-chip ${on ? 'is-active' : ''}`}
                      onClick={() => setForm({
                        ...form,
                        skills: on ? form.skills.filter((x) => x !== s) : [...form.skills, s],
                      })}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="fm-field fm-field--full">
              <label>培养目标</label>
              <textarea
                value={form.goal}
                onChange={(e) => setForm({ ...form, goal: e.target.value })}
                placeholder="例如：3 个月内能独立完成 ___ 项目"
              />
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="fm-mini" onClick={handleCreate}>📜 立约结对</button>
          </div>
        </div>
      )}

      {/* Detail */}
      {view === 'detail' && activePair && (
        <>
          <div className="fm-section">
            <div className="fm-section__head">
              <div className="fm-section__title">🎴 结对详情</div>
              <button className="fm-link" onClick={() => setView('list')}>← 返回</button>
            </div>
            <div className="fm-pair-detail">
              <div className="fm-pair-detail__title">
                {activePair.mentorName} <span className="fm-pair__arr">▸</span> {activePair.apprenticeName}
              </div>
              <div className="fm-pair-detail__bar">
                <div style={{ width: `${activePair.progress || 0}%` }} />
                <span>{activePair.progress || 0}%</span>
              </div>
              {activePair.goal && (
                <div className="fm-pair-detail__goal">🎯 目标：{activePair.goal}</div>
              )}
              <div className="fm-pair__skills">
                {(activePair.skills || []).map((s) => (
                  <span key={s} className="fm-tag">{s}</span>
                ))}
              </div>
              <div className="fm-pair-detail__meta">
                <span>{activePair.status === 'graduated'
                  ? `🏆 已出师 · ${new Date(activePair.graduatedAt).toLocaleDateString()}`
                  : `修行中 · ${new Date(activePair.createdAt).toLocaleDateString()} 起`}
                </span>
              </div>
            </div>
          </div>

          <div className="fm-section">
            <div className="fm-section__head">
              <div className="fm-section__title">📌 里程碑</div>
              <div className="fm-section__more">{(activePair.milestones || []).length}/5</div>
            </div>
            <div className="fm-milestones">
              {(activePair.milestones || []).map((m) => (
                <div key={m.id} className="fm-milestone">
                  <div className="fm-milestone__dot" />
                  <div>
                    <div>{m.text}</div>
                    <div className="fm-milestone__meta">
                      {m.by === 'mentor' ? '🧙 师父' : '🧑‍🎓 徒弟'} · {new Date(m.at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
              {(activePair.milestones || []).length === 0 && (
                <div className="fm-empty">还没记录里程碑 — 累计 5 个即可出师 🎯</div>
              )}
            </div>

            {activePair.status === 'active' && (
              <div className="fm-pair-detail__add">
                <input
                  value={milestoneText}
                  onChange={(e) => setMilestoneText(e.target.value)}
                  placeholder="今天传承了什么 / 学到了什么…"
                  onKeyDown={(e) => e.key === 'Enter' && handleLogMilestone()}
                />
                <button className="fm-mini" onClick={handleLogMilestone}>＋ 记录</button>
              </div>
            )}

            {activePair.status === 'active' &&
              activePair.mentorId === me.id &&
              (activePair.milestones || []).length >= 3 && (
              <div style={{ marginTop: 10, textAlign: 'right' }}>
                <button className="fm-mini fm-mini--gold" onClick={handleGraduate}>
                  🏆 让徒弟出师
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
