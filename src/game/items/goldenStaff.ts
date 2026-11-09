import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment. Tune with `bun run balance`.
export const GOLDEN_STAFF = {
  attackSpeed: 0.15,
  perAttack: 0.02, // Impulsive: attack speed per basic attack
  perAttackEnhanced: 0.035,
  stacks: 50,
};

const text = (per: number) =>
  `+${pct(GOLDEN_STAFF.attackSpeed)} attack speed. Impulsive (unique): each basic attack adds +${pct(per)} attack speed ` +
  `for the rest of the fight, stacking up to ${GOLDEN_STAFF.stacks} times.`;
const impulsive = (per: number) => ({
  effect: 'impulsive',
  on: 'basic' as const,
  perStack: [{ stat: 'attackSpeed' as const, add: per }],
  atMax: [],
  max: GOLDEN_STAFF.stacks,
  seconds: Infinity,
});

export const goldenStaff: ItemDef = {
  id: 'goldenstaff',
  name: 'Golden Staff',
  icon: '🦯',
  kind: 'offense',
  group: 'physical',
  maxTier: 1,
  desc: text(GOLDEN_STAFF.perAttack),
  values: () => ({}),
  mods: () => [{ stat: 'attackSpeed', add: GOLDEN_STAFF.attackSpeed }],
  stacking: impulsive(GOLDEN_STAFF.perAttack),
  enhanced: { desc: text(GOLDEN_STAFF.perAttackEnhanced), stacking: impulsive(GOLDEN_STAFF.perAttackEnhanced) },
};
