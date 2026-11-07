import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Per tier, index 0 = tier 1.
export const BLANGKON = {
  hp: 0.2, // every tier, max HP
  // Nether (unique): extra max HP, and the battle-start stun.
  netherHp: [0.25, 0.35, 0.5, 1.8],
  stun: [1, 1, 2, 3], // seconds
  area: { width: 3, depth: 3 },
};

export const blangkon: ItemDef = {
  id: 'blangkon',
  name: 'Blangkon',
  icon: '🧢',
  kind: 'defense',
  trait: 'gustiwana',
  membersOnly: true,
  maxTier: 4,
  desc:
    `+${pct(BLANGKON.hp)} max HP. Nether (unique): +{hp} more max HP, and at battle start stuns enemies in the ` +
    `${BLANGKON.area.width}×${BLANGKON.area.depth} tiles in front for {stun}.`,
  values: () => ({ hp: BLANGKON.netherHp.map(pct), stun: BLANGKON.stun.map((s) => `${s}s`) }),
  mods: () => [{ stat: 'hp', pct: BLANGKON.hp }],
  unique: (tier) => [{ stat: 'hp', pct: BLANGKON.netherHp[tier - 1] }],
  opener: (tier) => ({ ...BLANGKON.area, stunSeconds: BLANGKON.stun[tier - 1] }),
};
