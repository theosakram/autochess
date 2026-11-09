import { pct } from '../traits/format';
import type { ItemDef } from './types';

// No stats of its own; all in its passive. Not in the drop pool (yet).
export const GREAT_DRAGON_SPEAR = {
  chance: 0.2, // Dragon Flurry: each basic attack
  hits: 2, // extra attacks when it procs
  hybridAtkEnhanced: 0.2, // enhanced: + share of attack and magic attack
};

const text = (atk = 0) =>
  `${atk ? `+${pct(atk)} attack and magic attack. ` : ''}Dragon Flurry (unique): each basic attack has a ${pct(GREAT_DRAGON_SPEAR.chance)} chance ` +
  `to be followed by ${GREAT_DRAGON_SPEAR.hits} extra attacks.`;

export const greatDragonSpear: ItemDef = {
  id: 'greatdragonspear',
  name: 'Great Dragon Spear',
  icon: '🔱',
  kind: 'offense',
  maxTier: 1,
  exclusive: true,
  desc: text(),
  values: () => ({}),
  mods: () => [],
  flurry: { chance: GREAT_DRAGON_SPEAR.chance, hits: GREAT_DRAGON_SPEAR.hits },
  enhanced: {
    desc: text(GREAT_DRAGON_SPEAR.hybridAtkEnhanced),
    mods: () => [
      { stat: 'atk', pct: GREAT_DRAGON_SPEAR.hybridAtkEnhanced },
      { stat: 'ap', pct: GREAT_DRAGON_SPEAR.hybridAtkEnhanced },
    ],
  },
};
