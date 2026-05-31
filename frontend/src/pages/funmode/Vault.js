import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { employeeApi, attendanceApi, leaveApi } from '../../mock/api';
import {
  classOf, levelStats, RARITIES,
} from './engine';
import {
  CLASS_CARDS, REWARD_CARDS, REWARD_KEYS, UI_ICONS,
} from './assets';
import {
  ensureIdentityCard, tokensOf, chainStats, walletOf, shortWallet,
} from './ledger';
import IdentityCard from './IdentityCard';

export default function Vault() {
  const { session, tenant } = useApp();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('identity'); // identity | rewards | ledger
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session || !tenant) return;
      const emps = await employeeApi.list(tenant.id);
      const me =
        emps.find((e) => e.email && e.email.toLowerCase() === (session.email || '').toLowerCase()) ||
        emps.find((e) => e.fullName === session.name) ||
        emps[0];
      if (!me) return;
      const [att, lv] = await Promise.all([
        attendanceApi.list(tenant.id),
        leaveApi.list(tenant.id),
      ]);
      // Make sure identity card exists
      ensureIdentityCard(tenant.id, me);
      const tokens = tokensOf(tenant.id, me.id);
      if (!cancelled) setData({ me, tokens, attendance: att, leaves: lv });
    })();
    return () => { cancelled = true; };
  }, [session, tenant]);

  if (!data) {
    return (
      <div className="fm-loading">
        ◢ LOADING VAULT ◣
        <div className="fm-loading__bar"><div /></div>
      </div>
    );
  }

  const { me, tokens, attendance, leaves } = data;
  const stats = chainStats();
  const lvl = levelStats(me, { attendance, leaves });
  const wallet = walletOf(tenant.id, me.id);
  const identityTokens = tokens.filter((t) => t.cardType === 'identity');
  const rewardTokens   = tokens.filter((t) => t.cardType === 'reward');

  // Group reward tokens by cardKey + show as collection
  const rewardSet = {};
  for (const t of rewardTokens) {
    if (!rewardSet[t.cardKey]) rewardSet[t.cardKey] = [];
    rewardSet[t.cardKey].push(t);
  }
  const codexProgress = `${Object.keys(rewardSet).length}/${REWARD_KEYS.length}`;

  return (
    <>
      {/* Wallet header */}
      <div className="fm-wallet">
        <div className="fm-wallet__head">
          <img src={UI_ICONS.onchain_seal} alt="" className="fm-wallet__seal" />
          <div className="fm-wallet__title">链上钱包 · On-Chain Vault</div>
        </div>
        <div className="fm-wallet__addr" title={wallet}>
          {shortWallet(wallet)}
          <span className="fm-wallet__chip">HRMS Chain · Testnet</span>
        </div>
        <div className="fm-wallet__stats">
          <div className="fm-wallet__stat">
            <div className="fm-wallet__stat-val">{tokens.length}</div>
            <div className="fm-wallet__stat-lbl">持有卡牌</div>
          </div>
          <div className="fm-wallet__stat">
            <div className="fm-wallet__stat-val">{codexProgress}</div>
            <div className="fm-wallet__stat-lbl">图鉴进度</div>
          </div>
          <div className="fm-wallet__stat">
            <div className="fm-wallet__stat-val">#{stats.currentBlock}</div>
            <div className="fm-wallet__stat-lbl">当前区块</div>
          </div>
        </div>
      </div>

      {/* Sub-tab nav */}
      <div className="fm-subtabs">
        <button className={`fm-subtab ${tab === 'identity' ? 'is-active' : ''}`} onClick={() => setTab('identity')}>
          🪪 身份卡
        </button>
        <button className={`fm-subtab ${tab === 'rewards' ? 'is-active' : ''}`} onClick={() => setTab('rewards')}>
          🎴 奖励图鉴
        </button>
        <button className={`fm-subtab ${tab === 'ledger' ? 'is-active' : ''}`} onClick={() => setTab('ledger')}>
          🔗 链上记录
        </button>
      </div>

      {/* IDENTITY TAB */}
      {tab === 'identity' && (
        <div className="fm-section">
          <div className="fm-section__head">
            <div className="fm-section__title">★ 我的身份卡</div>
            <div className="fm-section__more">{identityTokens.length} 张</div>
          </div>
          {identityTokens.length === 0 ? (
            <div className="fm-empty">未铸造身份卡</div>
          ) : (
            <div className="fm-idcard-list">
              {identityTokens.map((tok) => (
                <IdentityCard key={tok.tokenId} employee={me} level={lvl.level} token={tok} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* REWARDS CODEX TAB */}
      {tab === 'rewards' && (
        <div className="fm-section">
          <div className="fm-section__head">
            <div className="fm-section__title">🎴 奖励卡图鉴</div>
            <div className="fm-section__more">{codexProgress}</div>
          </div>
          <div className="fm-codex">
            {REWARD_KEYS.map((key) => {
              const card = REWARD_CARDS[key];
              const owned = rewardSet[key] || [];
              const count = owned.length;
              const r = RARITIES[card.rarity];
              return (
                <div
                  key={key}
                  className={`fm-codexcard ${count === 0 ? 'is-locked' : ''}`}
                  style={{ '--c': r.color, '--g': r.glow }}
                  onClick={() => count > 0 && setSelected({ key, card, tokens: owned })}
                >
                  <div className="fm-codexcard__art" style={{ backgroundImage: `url(${card.img})` }}>
                    {count > 1 && <div className="fm-codexcard__count">×{count}</div>}
                    {count === 0 && <div className="fm-codexcard__lock">🔒</div>}
                    <img className="fm-codexcard__gem" src={UI_ICONS[`rarity_${card.rarity}`]} alt="" />
                  </div>
                  <div className="fm-codexcard__name">{card.name}</div>
                  <div className="fm-codexcard__rarity" style={{ color: r.color }}>{r.en}</div>
                </div>
              );
            })}
          </div>
          <div className="fm-codex-hint">
            点击已解锁卡牌查看链上证书 · 灰色卡牌通过打卡 / 完成任务解锁
          </div>
        </div>
      )}

      {/* LEDGER TAB */}
      {tab === 'ledger' && (
        <div className="fm-section">
          <div className="fm-section__head">
            <div className="fm-section__title">🔗 链上铸造记录</div>
            <div className="fm-section__more">{tokens.length} 笔</div>
          </div>
          <div className="fm-ledger">
            {tokens.length === 0 && <div className="fm-empty">暂无链上记录</div>}
            {tokens.map((t) => {
              const isReward = t.cardType === 'reward';
              const card = isReward ? REWARD_CARDS[t.cardKey] : null;
              const r = RARITIES[t.rarity];
              return (
                <div key={t.tokenId} className="fm-ledger__row" style={{ '--c': r.color }}>
                  <img
                    className="fm-ledger__thumb"
                    src={isReward ? card?.img : CLASS_CARDS[t.cardKey]}
                    alt=""
                  />
                  <div className="fm-ledger__body">
                    <div className="fm-ledger__top">
                      <strong>{isReward ? card?.name : (t.meta?.className || t.cardKey)}</strong>
                      <span className="fm-ledger__rarity" style={{ color: r.color }}>{r.en}</span>
                    </div>
                    <code className="fm-ledger__tx">{t.txHash.slice(0, 10)}…{t.txHash.slice(-6)}</code>
                    <div className="fm-ledger__meta">
                      <span>Block #{t.block}</span>
                      <span>·</span>
                      <span>{new Date(t.mintedAt).toLocaleString('zh-CN', { hour12: false })}</span>
                    </div>
                  </div>
                  <img src={UI_ICONS.onchain_seal} className="fm-ledger__seal" alt="" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected card detail modal */}
      {selected && (
        <div className="fm-mint" onClick={() => setSelected(null)}>
          <div className="fm-mint__inner" onClick={(e) => e.stopPropagation()}>
            <div
              className={`fm-mint__card fm-mint__card--${selected.card.rarity}`}
              style={{ '--c': RARITIES[selected.card.rarity].color, '--g': RARITIES[selected.card.rarity].glow }}
            >
              <div className="fm-mint__card-art" style={{ backgroundImage: `url(${selected.card.img})` }}>
                <div className="fm-mint__rarity" style={{ color: RARITIES[selected.card.rarity].color }}>
                  <img src={UI_ICONS[`rarity_${selected.card.rarity}`]} alt="" />
                  {RARITIES[selected.card.rarity].en} · {RARITIES[selected.card.rarity].stars}★
                </div>
                <div className="fm-mint__cardname">{selected.card.name}</div>
                <div className="fm-mint__cardsub">{selected.card.en} · 持有 ×{selected.tokens.length}</div>
              </div>
            </div>
            <div className="fm-mint__chain">
              <div className="fm-mint__chain-seal">
                <img src={UI_ICONS.onchain_seal} alt="" />
                <span>{selected.tokens.length} 次链上铸造</span>
              </div>
              <div className="fm-mint__chain-rows">
                {selected.tokens.slice(0, 3).map((t) => (
                  <div key={t.tokenId} className="fm-mint__chain-row">
                    <span>{new Date(t.mintedAt).toLocaleDateString()}</span>
                    <code>{t.tokenId}</code>
                  </div>
                ))}
                {selected.tokens.length > 3 && (
                  <div className="fm-mint__chain-row">
                    <span>更多</span>
                    <strong>+{selected.tokens.length - 3}</strong>
                  </div>
                )}
              </div>
              <button className="fm-mint__close" onClick={() => setSelected(null)}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
