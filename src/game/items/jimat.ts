import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Per tier, index 0 = tier 1.
export const JIMAT = {
  lifesteal: 0.2, // every tier, basic attacks
  spellLifesteal: 0.2, // every tier, everything else the holder deals
  lifestealEnhanced: 0.3, // both, enhanced
  // Sakti (unique): more damage dealt; at tier 4, more max HP too.
  damageAmp: [0.25, 0.35, 0.55, 1.5],
  hp: [0, 0, 0, 0.65],
};

const text = (ls: number, sls: number) =>
  `${pct(ls)} lifesteal and ${pct(sls)} spell lifesteal. ` + `Sakti (unique): deals +{amp} damage. At tier 4, also +${pct(JIMAT.hp[3])} max HP.`;
const steal = (ls: number, sls: number) => [
  { stat: 'lifesteal' as const, add: ls },
  { stat: 'spellLifesteal' as const, add: sls },
];

export const jimat: ItemDef = {
  id: 'jimat',
  name: 'Jimat',
  icon: '📿',
  kind: 'utility',
  trait: 'gustiwana',
  membersOnly: true,
  maxTier: 4,
  desc: text(JIMAT.lifesteal, JIMAT.spellLifesteal),
  values: () => ({ amp: JIMAT.damageAmp.map(pct) }),
  mods: () => steal(JIMAT.lifesteal, JIMAT.spellLifesteal),
  unique: (tier) => [
    { stat: 'damageAmp', add: JIMAT.damageAmp[tier - 1] },
    ...(JIMAT.hp[tier - 1] ? [{ stat: 'hp' as const, pct: JIMAT.hp[tier - 1] }] : []),
  ],
  enhanced: { desc: text(JIMAT.lifestealEnhanced, JIMAT.lifestealEnhanced), mods: () => steal(JIMAT.lifestealEnhanced, JIMAT.lifestealEnhanced) },
};
