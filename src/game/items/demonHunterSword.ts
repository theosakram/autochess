import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment. Tune with `bun run balance`.
export const DEMON_HUNTER_SWORD = {
  attackSpeed: 0.1,
  engulf: 0.02, // of the target's max hp, physical, per basic attack
  engulfEnhanced: 0.04,
};

const text = (engulf: number) =>
  `+${pct(DEMON_HUNTER_SWORD.attackSpeed)} attack speed. Engulf (unique): basic attacks deal extra physical damage ` +
  `equal to ${pct(engulf)} of the target's max HP.`;

export const demonHunterSword: ItemDef = {
  id: 'demonhuntersword',
  name: 'Demon Hunter Sword',
  icon: '😈',
  kind: 'offense',
  group: 'physical',
  maxTier: 1,
  desc: text(DEMON_HUNTER_SWORD.engulf),
  values: () => ({}),
  mods: () => [{ stat: 'attackSpeed', add: DEMON_HUNTER_SWORD.attackSpeed }],
  engulf: DEMON_HUNTER_SWORD.engulf,
  enhanced: { desc: text(DEMON_HUNTER_SWORD.engulfEnhanced), engulf: DEMON_HUNTER_SWORD.engulfEnhanced },
};
