import React from 'react';
import { CLASS_CARDS, UI_ICONS } from './assets';
import { classOf, powerOf, attributesOf, titleOf } from './engine';
import { shortWallet } from './ledger';
import { RARITIES } from './engine';

/**
 * Big anime-illustration identity card for an employee.
 * Displays: portrait + level + title + 6 attributes + on-chain seal.
 */
export default function IdentityCard({ employee, level, token, compact = false }) {
  if (!employee) return null;
  const cls = classOf(employee.department);
  const attrs = attributesOf(employee);
  const power = powerOf(employee, level || 1);
  const title = titleOf(level || 1);
  const img = CLASS_CARDS[cls.key] || CLASS_CARDS.adventurer;
  const rarity = token?.rarity || 'legendary';
  const r = RARITIES[rarity];

  return (
    <div
      className={`fm-idcard ${compact ? 'fm-idcard--compact' : ''}`}
      style={{ '--card-color': cls.color, '--card-glow': r.glow }}
    >
      <div className="fm-idcard__frame">
        <div className="fm-idcard__art" style={{ backgroundImage: `url(${img})` }}>
          {/* Rarity gem top-left */}
          <div className="fm-idcard__rarity">
            <img src={UI_ICONS[`rarity_${rarity}`]} alt={rarity} />
            <span style={{ color: r.color }}>{r.en}</span>
          </div>

          {/* Level badge top-right */}
          <div className="fm-idcard__level">
            <span className="fm-idcard__level-lbl">LV</span>
            <span className="fm-idcard__level-num">{level || 1}</span>
          </div>

          {/* Onchain seal bottom-right */}
          {token && (
            <div className="fm-idcard__seal" title={`Token ${token.tokenId}`}>
              <img src={UI_ICONS.onchain_seal} alt="on-chain" />
            </div>
          )}

          {/* Name plate at bottom */}
          <div className="fm-idcard__plate">
            <div className="fm-idcard__name">{employee.fullName}</div>
            <div className="fm-idcard__sub">
              <span style={{ color: cls.color }}>{cls.emoji} {cls.name}</span>
              <span className="fm-idcard__sep">·</span>
              <span style={{ color: title.color }}>{title.name}</span>
            </div>
            {token && (
              <div className="fm-idcard__chain">
                <span className="fm-idcard__chain-dot" />
                {token.tokenId}
              </div>
            )}
          </div>
        </div>
      </div>

      {!compact && (
        <div className="fm-idcard__statbar">
          <div className="fm-idcard__statitem">
            <div className="fm-idcard__statitem-val">{power}</div>
            <div className="fm-idcard__statitem-lbl">⚔ 战力</div>
          </div>
          <div className="fm-idcard__statitem">
            <div className="fm-idcard__statitem-val">{Math.max(...Object.values(attrs))}</div>
            <div className="fm-idcard__statitem-lbl">🌟 巅峰</div>
          </div>
          <div className="fm-idcard__statitem">
            <div className="fm-idcard__statitem-val">
              {token ? `#${token.block}` : '—'}
            </div>
            <div className="fm-idcard__statitem-lbl">🔗 区块</div>
          </div>
        </div>
      )}
    </div>
  );
}
