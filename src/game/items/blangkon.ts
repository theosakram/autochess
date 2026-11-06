import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Per tier, index 0 = tier 1.
export const BLANGKON = {
  hp: [0.2, 0.3, 0.5, 2],
  stun: [1, 1, 1, 1], // seconds, the same at every tier
  area: { width: 3, depth: 3 },
};

export const blangkon: ItemDef = {
  id: 'blangkon',
  name: 'Blangkon',
  icon: '🧢',
  kind: 'defense',
  trait: 'gustiwana',
  maxTier: 4,
  desc: `+{hp} max HP. At battle start, stuns enemies in the ${BLANGKON.area.width}×${BLANGKON.area.depth} tiles in front for {stun}.`,
  values: () => ({ hp: BLANGKON.hp.map(pct), stun: BLANGKON.stun.map((s) => `${s}s`) }),
  mods: (tier) => [{ stat: 'hp', pct: BLANGKON.hp[tier - 1] }],
  opener: (tier) => ({ ...BLANGKON.area, stunSeconds: BLANGKON.stun[tier - 1] }),
};
