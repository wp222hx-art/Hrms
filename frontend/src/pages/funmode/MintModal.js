import React, { useEffect, useState } from 'react';
import { REWARD_CARDS, UI_ICONS } from './assets';
import { RARITIES } from './engine';
import { shortWallet } from './ledger';

/**
 * Card-pull mint modal — overlays the screen and reveals a freshly-minted reward card.
 * Three stages:
 *   1) "pack" — sealed pack pulsing with rainbow energy
 *   2) "reveal" — card flips in with rarity light burst
 *   3) "chain" — shows on-chain tx hash + token id
 */
export default function MintModal({ open, token, onClose }) {
  const [stage, setStage] = useState('pack');

  useEffect(() => {
    if (!open) return;
    setStage('pack');
    const t1 = setTimeout(() => setStage('reveal'), 900);
    const t2 = setTimeout(() => setStage('chain'), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [open, token?.tokenId]);

  if (!open || !token) return null;
  const card = REWARD_CARDS[token.cardKey];
  if (!card) return null;
  const r = RARITIES[token.rarity] || RARITIES.common;

  return (
    <div className="fm-mint" onClick={onClose}>
      <div
        className="fm-mint__bg"
        style={{ backgroundImage: `url(${UI_ICONS.pack_bg})` }}
      />
      <div className="fm-mint__particles">
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} style={{ '--i': i, '--c': r.color }} />
        ))}
      </div>

      <div className="fm-mint__inner" onClick={(e) => e.stopPropagation()}>
        {stage === 'pack' && (
          <div className="fm-mint__pack">
            <div className="fm-mint__pack-orb" style={{ background: `radial-gradient(circle, ${r.color}, transparent 60%)` }} />
            <div className="fm-mint__pack-text">⚡ MINTING ON CHAIN ⚡</div>
            <div className="fm-mint__pack-sub">HRMS Chain · Block #{token.block}</div>
          </div>
        )}

        {(stage === 'reveal' || stage === 'chain') && (
          <div
            className={`fm-mint__card fm-mint__card--${token.rarity}`}
            style={{ '--c': r.color, '--g': r.glow }}
          >
            <div className="fm-mint__card-art" style={{ backgroundImage: `url(${card.img})` }}>
              <div className="fm-mint__rarity" style={{ color: r.color }}>
                <img src={UI_ICONS[`rarity_${token.rarity}`]} alt="" />
                {r.en} · {r.stars}★
              </div>
              <div className="fm-mint__cardname">{card.name}</div>
              <div className="fm-mint__cardsub">{card.en}</div>
            </div>
          </div>
        )}

        {stage === 'chain' && (
          <div className="fm-mint__chain">
            <div className="fm-mint__chain-seal">
              <img src={UI_ICONS.onchain_seal} alt="" />
              <span>ON-CHAIN VERIFIED</span>
            </div>
            <div className="fm-mint__chain-rows">
              <div className="fm-mint__chain-row">
                <span>Token ID</span>
                <strong>{token.tokenId}</strong>
              </div>
              <div className="fm-mint__chain-row">
                <span>Tx Hash</span>
                <code>{token.txHash.slice(0, 10)}…{token.txHash.slice(-6)}</code>
              </div>
              <div className="fm-mint__chain-row">
                <span>Block</span>
                <strong>#{token.block}</strong>
              </div>
              <div className="fm-mint__chain-row">
                <span>Holder</span>
                <code>{shortWallet(token.holder)}</code>
              </div>
              <div className="fm-mint__chain-row">
                <span>Gas</span>
                <strong>{token.gasFee} ETH-eq</strong>
              </div>
            </div>
            <button className="fm-mint__close" onClick={onClose}>
              ✨ 收入卡牌库
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
