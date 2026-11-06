import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment. Tune with `bun run balance`.
export const GOLDEN_STAFF = {
  attackSpeed: 0.15,
  perAttack: 0.02, // Impulsive: attack speed per basic attack
  stacks: 50,
};

export const goldenStaff: ItemDef = {
  id: 'goldenstaff',
  name: 'Golden Staff',
  icon: '🦯',
  kind: 'offense',
  maxTier: 1,
  desc:
    `+${pct(GOLDEN_STAFF.attackSpeed)} attack speed. Impulsive (unique): each basic attack adds +${pct(GOLDEN_STAFF.perAttack)} attack speed ` +
    `for the rest of the fight, stacking up to ${GOLDEN_STAFF.stacks} times.`,
  values: () => ({}),
  mods: () => [{ stat: 'attackSpeed', add: GOLDEN_STAFF.attackSpeed }],
  stacking: {
    effect: 'impulsive',
    on: 'basic',
    perStack: [{ stat: 'attackSpeed', add: GOLDEN_STAFF.perAttack }],
    atMax: [],
    max: GOLDEN_STAFF.stacks,
    seconds: Infinity,
  },
};
