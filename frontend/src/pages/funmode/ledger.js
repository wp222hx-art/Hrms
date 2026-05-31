/**
 * On-Chain Ledger (mock, browser-side).
 * Simulates an NFT-style ledger where each card minted produces a tx + block.
 * Persisted in localStorage so the user sees their wallet grow over time.
 */

import { REWARD_CARDS, REWARD_KEYS } from './assets';
import { classOf, comboMultiplier, comboOf } from './engine';

const STORAGE_KEY = 'hrms_chain_v1';
const CHAIN_PREFIX = '0xHRMS';
const GENESIS_BLOCK = 1_000_000;

/* ---------- Hash helpers (deterministic, NOT cryptographic) ---------- */
function sha256ish(str) {
  // Simple 64-hex pseudo-hash for display only (no real security required).
  let h1 = 0x9dc5, h2 = 0x811c, h3 = 0xc9dc, h4 = 0x5c5f;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = (h1 * 31 + c) >>> 0;
    h2 = (h2 * 17 + c * 13) >>> 0;
    h3 = (h3 * 131 + c * 7) >>> 0;
    h4 = (h4 * 257 + c * 3) >>> 0;
  }
  const hex = (n) => n.toString(16).padStart(8, '0');
  return (
    hex(h1) + hex(h2) + hex(h3) + hex(h4) +
    hex(h1 ^ h3) + hex(h2 ^ h4) + hex(h1 + h2) + hex(h3 + h4)
  );
}

function shortHash(h) {
  return `0x${h.slice(0, 6)}…${h.slice(-4)}`;
}

/* ---------- Persistence ---------- */
function loadChain() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tokens: [], blocks: GENESIS_BLOCK, tenants: {} };
    return JSON.parse(raw);
  } catch {
    return { tokens: [], blocks: GENESIS_BLOCK, tenants: {} };
  }
}

function saveChain(chain) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chain));
  } catch {
    /* quota — ignore */
  }
}

/* ---------- Wallet address (deterministic per tenant+employee) ---------- */
export function walletOf(tenantId, employeeId) {
  const seed = `wallet:${tenantId}:${employeeId}`;
  const h = sha256ish(seed);
  return `0x${h.slice(0, 40)}`;
}

export function shortWallet(addr) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/* ---------- Mint a new card (single tx) ---------- */
export function mintCard({
  tenantId,
  employeeId,
  employeeName,
  cardType,    // 'identity' | 'reward'
  cardKey,     // e.g. 'mage', 'combo', 'early_bird'
  rarity,
  meta = {},
}) {
  const chain = loadChain();
  const ts = Date.now();
  const blockNumber = chain.blocks + 1;
  const wallet = walletOf(tenantId, employeeId);

  const payload = {
    contract: 'HRMS-CARD-NFT-V1',
    tenant: tenantId,
    holder: wallet,
    employeeId,
    employeeName,
    cardType,
    cardKey,
    rarity,
    meta,
    timestamp: ts,
    block: blockNumber,
  };
  const txHash = '0x' + sha256ish(JSON.stringify(payload) + ts);
  const tokenId = `HRMS-${tenantId.slice(0, 4).toUpperCase()}-${employeeId.slice(-4)}-${blockNumber}`;

  const token = {
    tokenId,
    txHash,
    block: blockNumber,
    contract: 'HRMS-CARD-NFT-V1',
    tenantId,
    employeeId,
    employeeName,
    holder: wallet,
    cardType,
    cardKey,
    rarity,
    meta,
    mintedAt: ts,
    gasFee: (0.000_42 + ((blockNumber * 7) % 100) / 1_000_000).toFixed(6), // mock gas
    confirmations: 12,
  };

  chain.tokens.push(token);
  chain.blocks = blockNumber;
  if (!chain.tenants[tenantId]) chain.tenants[tenantId] = { totalMinted: 0 };
  chain.tenants[tenantId].totalMinted += 1;
  saveChain(chain);
  return token;
}

/* ---------- Query wallet ---------- */
export function tokensOf(tenantId, employeeId) {
  const chain = loadChain();
  return chain.tokens
    .filter((t) => t.tenantId === tenantId && t.employeeId === employeeId)
    .sort((a, b) => b.block - a.block);
}

export function tokenByKey(tenantId, employeeId, cardType, cardKey) {
  const chain = loadChain();
  return chain.tokens.find(
    (t) => t.tenantId === tenantId
      && t.employeeId === employeeId
      && t.cardType === cardType
      && t.cardKey === cardKey,
  );
}

export function chainStats() {
  const chain = loadChain();
  return {
    totalMinted: chain.tokens.length,
    currentBlock: chain.blocks,
    contract: 'HRMS-CARD-NFT-V1',
    chainName: 'HRMS Chain (Testnet)',
    chainId: 'hrms-1',
  };
}

/* ---------- Auto-mint helpers ---------- */

/**
 * Make sure the user has their class identity card minted.
 * Returns the token (creating one if needed).
 */
export function ensureIdentityCard(tenantId, employee) {
  const cls = classOf(employee.department);
  const existing = tokenByKey(tenantId, employee.id, 'identity', cls.key);
  if (existing) return existing;
  return mintCard({
    tenantId,
    employeeId: employee.id,
    employeeName: employee.fullName,
    cardType: 'identity',
    cardKey: cls.key,
    rarity: 'legendary',
    meta: {
      className: cls.name,
      classEn: cls.en,
      department: employee.department,
      hireDate: employee.hireDate,
    },
  });
}

/**
 * Pick a random reward card key based on the attendance context.
 * Deterministic-ish: combines current combo, date, and employee id.
 */
export function pickRewardKey(employee, attendance, action = 'in') {
  const combo = comboOf(employee, attendance);
  const mul = comboMultiplier(combo);

  // High combo → higher chance for rarer card
  const pool = [];
  pool.push('early_bird', 'punctuality', 'teamwork');
  if (combo >= 3) pool.push('combo');
  if (combo >= 5) pool.push('inspiration');
  if (combo >= 7) pool.push('perfect', 'overtime');
  if (combo >= 14) pool.push('champion');

  // Seed pseudo-random with employee + today + action
  const today = new Date().toISOString().slice(0, 10);
  const seed = `${employee.id}:${today}:${action}:${combo}`;
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % pool.length;
  return { key: pool[idx], combo, multiplier: mul };
}

/**
 * Has the user already minted a reward card for today?
 */
export function dailyRewardMintedToday(tenantId, employeeId, action = 'in') {
  const today = new Date().toISOString().slice(0, 10);
  const chain = loadChain();
  return chain.tokens.find(
    (t) => t.tenantId === tenantId
      && t.employeeId === employeeId
      && t.cardType === 'reward'
      && (t.meta?.action || 'in') === action
      && (t.meta?.date || '') === today,
  );
}

/**
 * Mint a daily reward card (if not already minted for that action today).
 * Returns { token, isNew, card }.
 */
export function mintDailyReward(tenantId, employee, attendance, action = 'in') {
  const already = dailyRewardMintedToday(tenantId, employee.id, action);
  if (already) {
    return {
      token: already,
      isNew: false,
      card: REWARD_CARDS[already.cardKey],
    };
  }
  const { key, combo, multiplier } = pickRewardKey(employee, attendance, action);
  const card = REWARD_CARDS[key];
  const today = new Date().toISOString().slice(0, 10);
  const token = mintCard({
    tenantId,
    employeeId: employee.id,
    employeeName: employee.fullName,
    cardType: 'reward',
    cardKey: key,
    rarity: card.rarity,
    meta: {
      date: today,
      action,
      combo,
      multiplierAt: multiplier.mult,
    },
  });
  return { token, isNew: true, card };
}

export { REWARD_KEYS };
