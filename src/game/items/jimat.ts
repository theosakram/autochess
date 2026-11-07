import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Per tier, index 0 = tier 1.
export const JIMAT = {
  lifesteal: 0.2, // every tier, basic attacks
  spellLifesteal: 0.2, // every tier, everything else the holder deals
  // Sakti (unique): more damage dealt; at tier 4, more max HP too.
  damageAmp: [0.25, 0.35, 0.55, 1.5],
  hp: [0, 0, 0, 0.65],
};

export const jimat: ItemDef = {
  id: 'jimat',
  name: 'Jimat',
  icon: '📿',
  kind: 'utility',
  trait: 'gustiwana',
  membersOnly: true,
  maxTier: 4,
  desc:
    `${pct(JIMAT.lifesteal)} lifesteal and ${pct(JIMAT.spellLifesteal)} spell lifesteal. ` +
    `Sakti (unique): deals +{amp} damage. At tier 4, also +${pct(JIMAT.hp[3])} max HP.`,
  values: () => ({ amp: JIMAT.damageAmp.map(pct) }),
  mods: () => [
    { stat: 'lifesteal', add: JIMAT.lifesteal },
    { stat: 'spellLifesteal', add: JIMAT.spellLifesteal },
  ],
  unique: (tier) => [
    { stat: 'damageAmp', add: JIMAT.damageAmp[tier - 1] },
    ...(JIMAT.hp[tier - 1] ? [{ stat: 'hp' as const, pct: JIMAT.hp[tier - 1] }] : []),
  ],
};
