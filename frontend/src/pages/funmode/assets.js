/**
 * Asset registry for funmode — maps logical names to public/ urls.
 * All images are webp-compressed, hosted at /cards/*.
 */

const root = process.env.PUBLIC_URL || '';

/* Class identity cards (9) */
export const CLASS_CARDS = {
  mage:       `${root}/cards/classes/mage.webp`,
  warrior:    `${root}/cards/classes/warrior.webp`,
  priest:     `${root}/cards/classes/priest.webp`,
  rogue:      `${root}/cards/classes/rogue.webp`,
  merchant:   `${root}/cards/classes/merchant.webp`,
  summoner:   `${root}/cards/classes/summoner.webp`,
  bard:       `${root}/cards/classes/bard.webp`,
  archer:     `${root}/cards/classes/archer.webp`,
  adventurer: `${root}/cards/classes/adventurer.webp`,
};

/* Daily reward / drop cards (8) */
export const REWARD_CARDS = {
  combo:       { img: `${root}/cards/rewards/combo.webp`,       name: '连击大师', en: 'Combo Master',       rarity: 'epic',      icon: '⚡', desc: '连续打卡达成 ≥3 天' },
  early_bird:  { img: `${root}/cards/rewards/early_bird.webp`,  name: '早起之力', en: 'Early Bird',          rarity: 'uncommon',  icon: '🌅', desc: '9:00 前完成打卡' },
  punctuality: { img: `${root}/cards/rewards/punctuality.webp`, name: '准时勋章', en: 'Punctuality',         rarity: 'rare',      icon: '⏰', desc: '当日无迟到' },
  overtime:    { img: `${root}/cards/rewards/overtime.webp`,    name: '加班战神', en: 'Overtime God',        rarity: 'epic',      icon: '🔥', desc: '工作时长 ≥10 小时' },
  perfect:     { img: `${root}/cards/rewards/perfect.webp`,     name: '全勤之冠', en: 'Perfect Attendance', rarity: 'legendary', icon: '👑', desc: '连续 7 天无迟到' },
  inspiration: { img: `${root}/cards/rewards/inspiration.webp`, name: '灵感时刻', en: 'Inspiration Moment',  rarity: 'rare',      icon: '💡', desc: '完成创新型任务' },
  teamwork:    { img: `${root}/cards/rewards/teamwork.webp`,    name: '协作之心', en: 'Teamwork Heart',      rarity: 'uncommon',  icon: '🤝', desc: '团队任务参与者' },
  champion:    { img: `${root}/cards/rewards/champion.webp`,    name: '周冠军',   en: 'Weekly Champion',     rarity: 'mythic',    icon: '🏆', desc: '周战力排名 #1' },
};

/* UI icons */
export const UI_ICONS = {
  tab_lobby:  `${root}/cards/ui/tab_lobby.webp`,
  tab_quest:  `${root}/cards/ui/tab_quest.webp`,
  tab_squad:  `${root}/cards/ui/tab_squad.webp`,
  tab_loot:   `${root}/cards/ui/tab_loot.webp`,
  tab_rank:   `${root}/cards/ui/tab_rank.webp`,
  tab_cards:  `${root}/cards/ui/tab_cards.webp`,

  rarity_common:    `${root}/cards/ui/rarity_common.webp`,
  rarity_uncommon:  `${root}/cards/ui/rarity_uncommon.webp`,
  rarity_rare:      `${root}/cards/ui/rarity_rare.webp`,
  rarity_epic:      `${root}/cards/ui/rarity_epic.webp`,
  rarity_legendary: `${root}/cards/ui/rarity_legendary.webp`,
  rarity_mythic:    `${root}/cards/ui/rarity_mythic.webp`,

  act_clock: `${root}/cards/ui/act_clock.webp`,
  act_combo: `${root}/cards/ui/act_combo.webp`,
  act_coin:  `${root}/cards/ui/act_coin.webp`,
  act_exp:   `${root}/cards/ui/act_exp.webp`,

  attr_sta: `${root}/cards/ui/attr_sta.webp`,
  attr_foc: `${root}/cards/ui/attr_foc.webp`,
  attr_col: `${root}/cards/ui/attr_col.webp`,
  attr_cre: `${root}/cards/ui/attr_cre.webp`,
  attr_end: `${root}/cards/ui/attr_end.webp`,
  attr_lrn: `${root}/cards/ui/attr_lrn.webp`,

  onchain_seal: `${root}/cards/ui/onchain_seal.webp`,
  pack_bg:      `${root}/cards/ui/pack_bg.webp`,
};

export const REWARD_KEYS = Object.keys(REWARD_CARDS);
