import { pct } from './format';
import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const MOONEATER = {
  stun: [1, 1.5], // seconds, every enemy in the Mooneater's column ahead of it
  attackSpeed: [0.45, 0.55], // every ally in its column, for the fight
};

export const mooneater: TraitDef = {
  id: 'mooneater',
  name: 'Mooneater',
  icon: '🌑',
  kind: 'faction',
  breakpoints: [2, 3],
  desc:
    'At battle start, each Mooneater stuns every enemy in its column ahead of it for {stun}, ' +
    'and every ally in its column gains +{as} attack speed for the fight.',
  values: () => ({ stun: MOONEATER.stun.map((s) => `${s}s`), as: MOONEATER.attackSpeed.map(pct) }),
  mods: () => [],
  opener: (level) => ({
    width: 1,
    depth: Infinity,
    stunSeconds: MOONEATER.stun[level - 1],
    columnAttackSpeed: MOONEATER.attackSpeed[level - 1],
  }),
};
