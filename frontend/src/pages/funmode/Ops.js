import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { employeeApi } from '../../mock/api';
import { UI_ICONS, REWARD_CARDS } from './assets';
import { RARITIES } from './engine';
import {
  listReceipts, decideReceipt,
  TRAINING_COURSES,
  EVENT_TEMPLATES, listEvents, createEvent, joinEvent, closeEvent,
  createAssignment, listAssignments,
  opsStats,
} from './hubStore';
import { mintCard, tokensOf } from './ledger';
import MintModal from './MintModal';

const TABS = [
  { id: 'dash',    label: '总览',    icon: '📊' },
  { id: 'bills',   label: '审报销',  icon: '🧾' },
  { id: 'events',  label: '搞活动',  icon: '🎉' },
  { id: 'train',   label: '派培训',  icon: '🎓' },
  { id: 'airdrop', label: '空投卡',  icon: '✨' },
];

/**
 * HR Admin Console — cyberpunk-styled command deck.
 * Visible to all (read-only for non-HR), but action buttons gated by role.
 */
export default function Ops() {
  const { session, tenant, role } = useApp();
  const [emps, setEmps] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [events, setEvents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [tab, setTab] = useState('dash');
  const [mint, setMint] = useState(null);
  const [toast, setToast] = useState(null);

  const isHR = role === 'hr_admin' || role === 'super_admin' || role === 'manager';

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(null), 1800); };

  const refresh = () => {
    if (!tenant) return;
    setReceipts(listReceipts(tenant.id));
    setEvents(listEvents(tenant.id));
    setAssignments(listAssignments(tenant.id));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tenant) return;
      const list = await employeeApi.list(tenant.id);
      if (!cancelled) {
        setEmps(list);
        refresh();
      }
    })();
    return () => { cancelled = true; };
  }, [tenant]);

  const stats = useMemo(
    () => (tenant ? opsStats(tenant.id) : {}),
    // recompute on every panel-data refresh
    [tenant, receipts, events, assignments],
  );

  /* ----- Receipts ----- */
  const handleDecide = (id, decision) => {
    if (!isHR) { showToast('需要 HR 权限'); return; }
    decideReceipt(tenant.id, id, decision, `审核于 ${new Date().toLocaleString()}`);
    refresh();
    showToast(decision === 'approved' ? '✅ 已通过' : '❌ 已驳回');
  };

  /* ----- Events ----- */
  const handleLaunchEvent = (tpl) => {
    if (!isHR) { showToast('需要 HR 权限'); return; }
    const ev = createEvent(tenant.id, {
      name: tpl.name,
      icon: tpl.icon,
      rewardCard: tpl.rewardCard,
      value: tpl.defaultValue,
      description: `${tpl.name} · 全员可参与领取`,
      launchedBy: session?.name,
    });
    refresh();
    showToast(`🎉 ${ev.name} 已开启`);
  };

  const handleJoinEvent = (ev) => {
    if (!session) return;
    const myEmp = emps.find((e) => e.email && e.email.toLowerCase() === (session.email || '').toLowerCase())
                || emps.find((e) => e.fullName === session.name);
    if (!myEmp) { showToast('找不到员工档案'); return; }
    const res = joinEvent(tenant.id, ev.id, myEmp.id);
    if (res?.error === 'joined') { showToast('已参与'); return; }
    if (res?.error === 'closed') { showToast('活动已关闭'); return; }
    if (res?.ok) {
      refresh();
      // Mint matching card
      const card = REWARD_CARDS[ev.rewardCard];
      if (card) {
        const token = mintCard({
          tenantId: tenant.id,
          employeeId: myEmp.id,
          employeeName: myEmp.fullName,
          cardType: 'reward',
          cardKey: ev.rewardCard,
          rarity: card.rarity,
          meta: {
            source: 'ops_event',
            eventId: ev.id,
            eventName: ev.name,
            value: ev.value,
            date: new Date().toISOString().slice(0, 10),
          },
        });
        setTimeout(() => setMint({ token }), 200);
      } else {
        showToast(`🎁 已参与 · ${ev.value}`);
      }
    }
  };

  const handleCloseEvent = (ev) => {
    if (!isHR) { showToast('需要 HR 权限'); return; }
    if (!window.confirm(`关闭活动「${ev.name}」？`)) return;
    closeEvent(tenant.id, ev.id);
    refresh();
  };

  /* ----- Training assignments ----- */
  const [asnForm, setAsnForm] = useState({ courseId: '', targets: 'all', due: '' });
  const handleCreateAsn = () => {
    if (!isHR) { showToast('需要 HR 权限'); return; }
    if (!asnForm.courseId) { showToast('请选择课程'); return; }
    const course = TRAINING_COURSES.find((c) => c.id === asnForm.courseId);
    createAssignment(tenant.id, {
      courseId: asnForm.courseId,
      courseName: course?.name,
      targets: 'all',
      dueDate: asnForm.due || null,
      pushedBy: session?.name,
    });
    setAsnForm({ courseId: '', targets: 'all', due: '' });
    refresh();
    showToast(`📚 已向全员推送：${course?.name}`);
  };

  /* ----- Airdrop ----- */
  const [airdrop, setAirdrop] = useState({ cardKey: 'birthday', employeeId: 'all', reason: '' });
  const handleAirdrop = () => {
    if (!isHR) { showToast('需要 HR 权限'); return; }
    const card = REWARD_CARDS[airdrop.cardKey];
    if (!card) return;
    let count = 0;
    const targets = airdrop.employeeId === 'all'
      ? emps
      : emps.filter((e) => e.id === airdrop.employeeId);
    targets.forEach((emp) => {
      const tokens = tokensOf(tenant.id, emp.id);
      const dup = tokens.some(
        (t) => t.cardKey === airdrop.cardKey
            && t.meta?.airdropReason === airdrop.reason
            && (Date.now() - new Date(t.mintedAt || 0).getTime()) < 24 * 3600 * 1000,
      );
      if (dup) return;
      mintCard({
        tenantId: tenant.id,
        employeeId: emp.id,
        employeeName: emp.fullName,
        cardType: 'reward',
        cardKey: airdrop.cardKey,
        rarity: card.rarity,
        meta: {
          source: 'ops_airdrop',
          airdropReason: airdrop.reason || '指挥官空投',
          by: session?.name,
          date: new Date().toISOString().slice(0, 10),
        },
      });
      count++;
    });
    showToast(`✨ 已向 ${count} 位员工空投「${card.name}」`);
    setAirdrop({ ...airdrop, reason: '' });
  };

  return (
    <>
      {toast && <div className="fm-toast">{toast}</div>}
      <MintModal open={!!mint} token={mint?.token} onClose={() => setMint(null)} />

      {/* Header */}
      <div className="fm-section fm-ops-hero">
        <div className="fm-expense-hero__top">
          <img src={UI_ICONS.ic_ops} alt="" className="fm-expense-hero__icon" />
          <div>
            <div className="fm-expense-hero__title">指挥控制台 · HR Ops</div>
            <div className="fm-expense-hero__sub">
              {isHR ? '🛡️ 指挥官身份 · 可发布活动 / 审核 / 空投' : '👁️ 旁观模式 · 可参与活动'}
            </div>
          </div>
        </div>
        <div className="fm-expense-hero__stats">
          <div className="fm-expense-hero__stat">
            <div className="fm-expense-hero__stat-val">{stats.receiptsPending || 0}</div>
            <div className="fm-expense-hero__stat-lbl">待审报销</div>
          </div>
          <div className="fm-expense-hero__stat">
            <div className="fm-expense-hero__stat-val">{stats.activeEvents || 0}</div>
            <div className="fm-expense-hero__stat-lbl">活动中</div>
          </div>
          <div className="fm-expense-hero__stat">
            <div className="fm-expense-hero__stat-val">{stats.assignments || 0}</div>
            <div className="fm-expense-hero__stat-lbl">培训任务</div>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="fm-section" style={{ paddingTop: 6, paddingBottom: 6 }}>
        <div className="fm-subtabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`fm-subtab ${tab === t.id ? 'is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* DASH */}
      {tab === 'dash' && (
        <div className="fm-section">
          <div className="fm-section__head">
            <div className="fm-section__title">📊 战情大屏</div>
          </div>
          <div className="fm-ops-grid">
            <DashTile color="#ff2ec8" icon="🧾" label="历史报销" val={stats.receiptsTotal || 0} sub={`${stats.receiptsPending || 0} 待审`} />
            <DashTile color="#40e0ff" icon="🎁" label="福利发放" val={stats.welfareGiven || 0} sub="累计兑换" />
            <DashTile color="#ffd54f" icon="🎉" label="活动" val={`${stats.activeEvents || 0}/${stats.totalEvents || 0}`} sub="活跃 / 总数" />
            <DashTile color="#9c27b0" icon="💬" label="动态" val={stats.posts || 0} sub="动态墙发布" />
            <DashTile color="#26c6da" icon="🤝" label="师徒" val={`${stats.mentorships || 0}/${stats.graduations || 0}`} sub="进行中 / 已出师" />
            <DashTile color="#7c4dff" icon="🎓" label="培训任务" val={stats.assignments || 0} sub="累计派发" />
          </div>

          <div className="fm-section__head" style={{ marginTop: 18 }}>
            <div className="fm-section__title">⚡ 快捷指挥</div>
          </div>
          <div className="fm-formgrid">
            <button className="fm-bigbtn fm-bigbtn--qr" onClick={() => setTab('events')}>
              <div className="fm-bigbtn__title">🎉 开启活动</div>
              <div className="fm-bigbtn__sub">生日会/节日/创新挑战赛</div>
            </button>
            <button className="fm-bigbtn fm-bigbtn--photo" onClick={() => setTab('bills')}>
              <div className="fm-bigbtn__title">🧾 审批报销</div>
              <div className="fm-bigbtn__sub">待审 {stats.receiptsPending || 0} 笔</div>
            </button>
            <button className="fm-bigbtn fm-bigbtn--manual" onClick={() => setTab('train')}>
              <div className="fm-bigbtn__title">🎓 派发培训</div>
              <div className="fm-bigbtn__sub">推送学习任务</div>
            </button>
          </div>
        </div>
      )}

      {/* BILLS */}
      {tab === 'bills' && (
        <div className="fm-section">
          <div className="fm-section__head">
            <div className="fm-section__title">🧾 报销审核台</div>
            <div className="fm-section__more">{receipts.length} 笔</div>
          </div>
          {receipts.length === 0 && <div className="fm-empty">没有任何报销单</div>}
          <div className="fm-receipt-list">
            {receipts.map((r) => {
              const emp = emps.find((e) => e.id === r.employeeId);
              return (
                <div key={r.id} className={`fm-receipt fm-receipt--${r.status}`}>
                  <div className="fm-receipt__icon">{
                    r.category === '餐饮' ? '🍜' :
                    r.category === '交通' ? '🚕' :
                    r.category === '差旅' ? '✈️' :
                    r.category === '办公用品' ? '🖇️' : '📄'
                  }</div>
                  <div className="fm-receipt__body">
                    <div className="fm-receipt__top">
                      <strong>{r.merchant || '未填写'}</strong>
                      <span className="fm-receipt__amount">¥{Number(r.amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="fm-receipt__meta">
                      <span>{emp?.fullName || r.employeeId}</span>
                      <span>·</span>
                      <span>{r.category || '其他'}</span>
                      <span>·</span>
                      <span>{r.date}</span>
                    </div>
                    {r.note && <div className="fm-receipt__note">备注：{r.note}</div>}
                  </div>
                  {r.status === 'pending' && isHR ? (
                    <div className="fm-receipt__ops">
                      <button className="fm-mini fm-mini--green" onClick={() => handleDecide(r.id, 'approved')}>通过</button>
                      <button className="fm-mini fm-mini--red"   onClick={() => handleDecide(r.id, 'rejected')}>驳回</button>
                    </div>
                  ) : (
                    <span className={`fm-receipt__status fm-receipt__status--${r.status}`}>
                      {{ pending:'待审', approved:'已通过', rejected:'已驳回', paid:'已打款' }[r.status] || r.status}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* EVENTS */}
      {tab === 'events' && (
        <>
          {isHR && (
            <div className="fm-section">
              <div className="fm-section__head">
                <div className="fm-section__title">🚀 一键开启活动</div>
              </div>
              <div className="fm-event-tpls">
                {EVENT_TEMPLATES.map((t) => {
                  const r = REWARD_CARDS[t.rewardCard];
                  const rar = RARITIES[r?.rarity || 'epic'];
                  return (
                    <button
                      key={t.id}
                      className="fm-event-tpl"
                      style={{ '--c': rar.color, '--g': rar.glow }}
                      onClick={() => handleLaunchEvent(t)}
                    >
                      <div className="fm-event-tpl__icon">{t.icon}</div>
                      <div className="fm-event-tpl__name">{t.name}</div>
                      <div className="fm-event-tpl__val">{t.defaultValue}</div>
                      <div className="fm-event-tpl__card">→ {r?.name || t.rewardCard} 卡</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="fm-section">
            <div className="fm-section__head">
              <div className="fm-section__title">🎉 进行中的活动</div>
              <div className="fm-section__more">{events.length} 个</div>
            </div>
            {events.length === 0 && <div className="fm-empty">还没有开启过活动</div>}
            <div className="fm-event-list">
              {events.map((ev) => {
                const card = REWARD_CARDS[ev.rewardCard];
                const myEmp = emps.find((e) => e.email && e.email.toLowerCase() === (session?.email || '').toLowerCase())
                            || emps.find((e) => e.fullName === session?.name);
                const joined = myEmp && ev.participants.includes(myEmp.id);
                const closed = ev.status !== 'active';
                return (
                  <div key={ev.id} className={`fm-event ${closed ? 'is-closed' : ''}`}>
                    <div className="fm-event__icon">{ev.icon || '🎉'}</div>
                    <div className="fm-event__body">
                      <div className="fm-event__name">{ev.name}</div>
                      <div className="fm-event__sub">
                        奖励：{ev.value} · 卡牌：{card?.name || ev.rewardCard}
                      </div>
                      <div className="fm-event__meta">
                        {new Date(ev.createdAt).toLocaleDateString()} ·
                        {ev.launchedBy ? ` 由 ${ev.launchedBy} 发起` : ''} ·
                        {ev.participants.length} 人参与
                      </div>
                    </div>
                    <div className="fm-event__ops">
                      {!closed && (
                        <button
                          className={`fm-mini ${joined ? 'is-disabled' : ''}`}
                          disabled={joined}
                          onClick={() => handleJoinEvent(ev)}
                        >
                          {joined ? '✓ 已参与' : '🎁 参与'}
                        </button>
                      )}
                      {!closed && isHR && (
                        <button className="fm-mini fm-mini--red" onClick={() => handleCloseEvent(ev)}>
                          关闭
                        </button>
                      )}
                      {closed && <span className="fm-tag">已结束</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* TRAINING */}
      {tab === 'train' && (
        <>
          {isHR && (
            <div className="fm-section">
              <div className="fm-section__head">
                <div className="fm-section__title">📚 推送培训任务</div>
              </div>
              <div className="fm-formgrid">
                <div className="fm-field fm-field--full">
                  <label>选择课程</label>
                  <select
                    value={asnForm.courseId}
                    onChange={(e) => setAsnForm({ ...asnForm, courseId: e.target.value })}
                  >
                    <option value="">-- 选择课程 --</option>
                    {TRAINING_COURSES.map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name} ({c.duration})</option>
                    ))}
                  </select>
                </div>
                <div className="fm-field fm-field--full">
                  <label>截止日期（可选）</label>
                  <input
                    type="date"
                    value={asnForm.due}
                    onChange={(e) => setAsnForm({ ...asnForm, due: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ marginTop: 10, textAlign: 'right' }}>
                <button className="fm-mini" onClick={handleCreateAsn}>🚀 推送给全员</button>
              </div>
            </div>
          )}

          <div className="fm-section">
            <div className="fm-section__head">
              <div className="fm-section__title">📜 历史任务</div>
              <div className="fm-section__more">{assignments.length} 条</div>
            </div>
            {assignments.length === 0 && <div className="fm-empty">还没有推送过培训</div>}
            <div className="fm-receipt-list">
              {assignments.map((a) => (
                <div key={a.id} className="fm-receipt fm-receipt--approved">
                  <div className="fm-receipt__icon">🎓</div>
                  <div className="fm-receipt__body">
                    <div className="fm-receipt__top">
                      <strong>{a.courseName || a.courseId}</strong>
                      <span className="fm-receipt__amount">全员</span>
                    </div>
                    <div className="fm-receipt__meta">
                      <span>推送：{new Date(a.createdAt).toLocaleDateString()}</span>
                      {a.dueDate && (<><span>·</span><span>截止：{a.dueDate}</span></>)}
                      {a.pushedBy && (<><span>·</span><span>by {a.pushedBy}</span></>)}
                    </div>
                  </div>
                  <span className="fm-receipt__status fm-receipt__status--paid">已派发</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* AIRDROP */}
      {tab === 'airdrop' && (
        <div className="fm-section">
          <div className="fm-section__head">
            <div className="fm-section__title">✨ 限定卡空投</div>
          </div>
          {!isHR && (
            <div className="fm-empty">需 HR / 管理员权限 · 当前只读</div>
          )}
          {isHR && (
            <>
              <div className="fm-formgrid">
                <div className="fm-field">
                  <label>选择卡牌</label>
                  <select
                    value={airdrop.cardKey}
                    onChange={(e) => setAirdrop({ ...airdrop, cardKey: e.target.value })}
                  >
                    {Object.entries(REWARD_CARDS).map(([k, c]) => (
                      <option key={k} value={k}>{c.icon} {c.name} · {RARITIES[c.rarity].name}</option>
                    ))}
                  </select>
                </div>
                <div className="fm-field">
                  <label>目标</label>
                  <select
                    value={airdrop.employeeId}
                    onChange={(e) => setAirdrop({ ...airdrop, employeeId: e.target.value })}
                  >
                    <option value="all">全员空投</option>
                    {emps.map((e) => (
                      <option key={e.id} value={e.id}>{e.fullName} · {e.department}</option>
                    ))}
                  </select>
                </div>
                <div className="fm-field fm-field--full">
                  <label>空投原因（写在 NFT meta 上）</label>
                  <input
                    value={airdrop.reason}
                    onChange={(e) => setAirdrop({ ...airdrop, reason: e.target.value })}
                    placeholder="例：Q3 季度战神 / 国庆福利 / 项目里程碑"
                  />
                </div>
              </div>
              <div style={{ marginTop: 10, textAlign: 'right' }}>
                <button className="fm-mini fm-mini--gold" onClick={handleAirdrop}>
                  ✨ 一键空投
                </button>
              </div>
              <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.8 }}>
                • 空投会铸造对应 NFT，永久记录在链上<br />
                • 同原因 24 小时内不会重复给同一员工<br />
                • 全员空投按选定卡稀有度发放
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

function DashTile({ icon, label, val, sub, color }) {
  return (
    <div className="fm-ops-tile" style={{ '--c': color }}>
      <div className="fm-ops-tile__icon">{icon}</div>
      <div className="fm-ops-tile__val">{val}</div>
      <div className="fm-ops-tile__lbl">{label}</div>
      <div className="fm-ops-tile__sub">{sub}</div>
    </div>
  );
}
