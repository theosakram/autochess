import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Per tier, index 0 = tier 1.
export const JIMAT = {
  lifesteal: 0.2, // every tier, basic attacks
  spellLifesteal: 0.2, // every tier, everything else the holder deals
  damageAmp: [0.2, 0.3, 0.5, 1],
};

export const jimat: ItemDef = {
  id: 'jimat',
  name: 'Jimat',
  icon: '📿',
  kind: 'utility',
  trait: 'gustiwana',
  maxTier: 4,
  desc: `${pct(JIMAT.lifesteal)} lifesteal and ${pct(JIMAT.spellLifesteal)} spell lifesteal. Deals +{amp} damage.`,
  values: () => ({ amp: JIMAT.damageAmp.map(pct) }),
  mods: (tier) => [
    { stat: 'lifesteal', add: JIMAT.lifesteal },
    { stat: 'spellLifesteal', add: JIMAT.spellLifesteal },
    { stat: 'damageAmp', add: JIMAT.damageAmp[tier - 1] },
  ],
};
