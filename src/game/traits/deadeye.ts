import { pct } from './format';
import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const DEADEYE = {
  critChance: [0.2, 0.25, 0.4], // every ally, basic attacks only
  critDamage: [1.5, 2.5, 3], // extra crit damage for Deadeyes, on top of the base 150%
};

export const deadeye: TraitDef = {
  id: 'deadeye',
  name: 'Deadeye',
  icon: '🎯',
  kind: 'role',
  breakpoints: [2, 4, 6],
  desc: 'All allies gain {chance} crit chance on basic attacks. Deadeyes crit for +{damage} damage.',
  values: () => ({
    chance: DEADEYE.critChance.map(pct),
    damage: DEADEYE.critDamage.map(pct),
  }),
  mods: ({ level, member }) => [
    { stat: 'critChance', add: DEADEYE.critChance[level - 1] },
    ...(member ? [{ stat: 'critDamage' as const, add: DEADEYE.critDamage[level - 1] }] : []),
  ],
};
