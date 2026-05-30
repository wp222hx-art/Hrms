import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { employeeApi } from '../../mock/api';
import { UI_ICONS, REWARD_CARDS } from './assets';
import { RARITIES } from './engine';
import {
  WELFARE_CATALOG, listWelfareClaims, claimWelfare, detectWelfareTriggers,
} from './hubStore';
import { mintCard } from './ledger';
import MintModal from './MintModal';

/**
 * Welfare / Benefits hub — birthday, festival, tenure, referral...
 * Each claim mints a corresponding NFT card on-chain.
 */
export default function Welfare() {
  const { session, tenant } = useApp();
  const [me, setMe] = useState(null);
  const [claims, setClaims] = useState([]);
  const [mint, setMint] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tenant) return;
      const emps = await employeeApi.list(tenant.id);
      const found =
        emps.find((e) => e.email && e.email.toLowerCase() === (session?.email || '').toLowerCase()) ||
        emps.find((e) => e.fullName === session?.name) ||
        emps[0];
      if (!cancelled && found) {
        setMe(found);
        setClaims(listWelfareClaims(tenant.id, found.id));
      }
    })();
    return () => { cancelled = true; };
  }, [tenant, session]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  if (!me) {
    return (
      <div className="fm-loading">
        ◢ LOADING WELFARE ◣
        <div className="fm-loading__bar"><div /></div>
      </div>
    );
  }

  const triggers = detectWelfareTriggers(me);
  const claimedIds = new Set(claims.map((c) => `${c.welfareId}:${c.periodKey}`));

  const handleClaim = (w) => {
    const res = claimWelfare(tenant.id, me, w.id);
    if (!res) return;
    if (res.existing) {
      showToast('已在本周期领取过');
      return;
    }
    setClaims(listWelfareClaims(tenant.id, me.id));
    // Mint matching NFT card
    const card = REWARD_CARDS[w.cardKey];
    if (card) {
      const token = mintCard({
        tenantId: tenant.id,
        employeeId: me.id,
        employeeName: me.fullName,
        cardType: 'reward',
        cardKey: w.cardKey,
        rarity: w.rarity || card.rarity,
        meta: {
          source: 'welfare',
          welfareId: w.id,
          welfareName: w.name,
          value: w.value,
          date: new Date().toISOString().slice(0, 10),
        },
      });
      setTimeout(() => setMint({ token }), 200);
    } else {
      showToast(`✅ 已领取 · ${w.name}`);
    }
  };

  const totalValue = claims.length;

  return (
    <>
      {toast && <div className="fm-toast">{toast}</div>}
      <MintModal open={!!mint} token={mint?.token} onClose={() => setMint(null)} />

      {/* Header */}
      <div className="fm-section fm-welfare-hero">
        <div className="fm-expense-hero__top">
          <img src={UI_ICONS.ic_welfare} alt="" className="fm-expense-hero__icon" />
          <div>
            <div className="fm-expense-hero__title">福利大厅 · Welfare</div>
            <div className="fm-expense-hero__sub">生日礼金 · 节日红包 · 工龄奖 · 内推奖</div>
          </div>
        </div>
        <div className="fm-expense-hero__stats">
          <div className="fm-expense-hero__stat">
            <div className="fm-expense-hero__stat-val">{totalValue}</div>
            <div className="fm-expense-hero__stat-lbl">已领福利</div>
          </div>
          <div className="fm-expense-hero__stat">
            <div className="fm-expense-hero__stat-val">{triggers.length}</div>
            <div className="fm-expense-hero__stat-lbl">可领取</div>
          </div>
          <div className="fm-expense-hero__stat">
            <div className="fm-expense-hero__stat-val">{WELFARE_CATALOG.length}</div>
            <div className="fm-expense-hero__stat-lbl">福利项</div>
          </div>
        </div>
      </div>

      {/* Hot triggers */}
      {triggers.length > 0 && (
        <div className="fm-section fm-welfare-alert">
          <div className="fm-section__head">
            <div className="fm-section__title">🔥 即将到期</div>
          </div>
          {triggers.map((tr) => {
            const w = WELFARE_CATALOG.find((x) => x.id === tr.id);
            if (!w) return null;
            const already = claimedIds.has(`${w.id}:${claims.find((c) => c.welfareId === w.id)?.periodKey || ''}`);
            return (
              <div key={tr.id} className="fm-welfare-alert__row">
                <div className="fm-welfare-alert__icon">{w.icon}</div>
                <div className="fm-welfare-alert__body">
                  <div className="fm-welfare-alert__name">{w.name}</div>
                  <div className="fm-welfare-alert__sub">{tr.label}</div>
                  <div className="fm-welfare-alert__val">{w.value}</div>
                </div>
                <button
                  className={`fm-mini ${already ? 'is-disabled' : ''}`}
                  onClick={() => !already && handleClaim(w)}
                  disabled={already}
                >
                  {already ? '已领取' : '🎁 立即领取'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Full catalog */}
      <div className="fm-section">
        <div className="fm-section__head">
          <div className="fm-section__title">🎁 福利商城</div>
          <div className="fm-section__more">{WELFARE_CATALOG.length} 项</div>
        </div>
        <div className="fm-welfare-grid">
          {WELFARE_CATALOG.map((w) => {
            const r = RARITIES[w.rarity];
            const already = claims.some((c) => c.welfareId === w.id);
            return (
              <div
                key={w.id}
                className={`fm-welfare-card ${already ? 'is-claimed' : ''}`}
                style={{ '--c': r.color, '--g': r.glow }}
              >
                <div className="fm-welfare-card__icon">{w.icon}</div>
                <div className="fm-welfare-card__name">{w.name}</div>
                <div className="fm-welfare-card__val" style={{ color: r.color }}>{w.value}</div>
                <div className="fm-welfare-card__period">{
                  { monthly: '每月', quarterly: '每季', yearly: '每年', event: '触发' }[w.period]
                } · {RARITIES[w.rarity].en}</div>
                <button
                  className="fm-mini fm-welfare-card__btn"
                  onClick={() => handleClaim(w)}
                  disabled={already}
                >
                  {already ? '✓ 已领取' : '兑换'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* History */}
      <div className="fm-section">
        <div className="fm-section__head">
          <div className="fm-section__title">📜 领取记录</div>
          <div className="fm-section__more">{claims.length} 笔</div>
        </div>
        {claims.length === 0 && <div className="fm-empty">还没有领取记录</div>}
        <div className="fm-receipt-list">
          {claims.map((c) => {
            const w = WELFARE_CATALOG.find((x) => x.id === c.welfareId);
            return (
              <div key={c.id} className="fm-receipt fm-receipt--paid">
                <div className="fm-receipt__icon">{w?.icon || '🎁'}</div>
                <div className="fm-receipt__body">
                  <div className="fm-receipt__top">
                    <strong>{c.welfareName}</strong>
                    <span className="fm-receipt__amount">{c.value}</span>
                  </div>
                  <div className="fm-receipt__meta">
                    <span>{new Date(c.claimedAt).toLocaleDateString()}</span>
                    <span>·</span>
                    <span>周期 {c.periodKey}</span>
                  </div>
                </div>
                <span className="fm-receipt__status fm-receipt__status--paid">已发放</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rules */}
      <div className="fm-section">
        <div className="fm-section__head">
          <div className="fm-section__title">📖 福利规则</div>
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-2)' }}>
          • 生日福利在 <strong style={{color:'var(--neon-pink)'}}>本月生日</strong> 自动解锁<br />
          • 节日福利在 <strong style={{color:'var(--neon-red)'}}>节日窗口</strong> 内可领取<br />
          • 工龄奖在 <strong style={{color:'var(--neon-gold,#ffd54f)'}}>入职周年</strong> 自动解锁<br />
          • 内推奖在新员工 <strong style={{color:'var(--neon-green)'}}>转正后</strong> 发放<br />
          • 每次领取自动铸造对应卡牌 NFT，可在 <strong style={{color:'var(--neon-cyan)'}}>CARDS</strong> 查看证书
        </div>
      </div>
    </>
  );
}
