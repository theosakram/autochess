import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Basic item. Tune with `bun run balance`.
export const PURIFY = {
  attackSpeed: 0.15,
  seconds: 30, // immune to control and displacement from the start of the fight
};

export const purify: ItemDef = {
  id: 'purify',
  name: 'Purify',
  icon: '✨',
  kind: 'defense',
  maxTier: 1,
  basic: true,
  desc:
    `+${pct(PURIFY.attackSpeed)} attack speed. Purify (unique): for the first ${PURIFY.seconds}s of a fight, ` +
    "immune to control and displacement: it can't be stunned, taunted, pulled or pushed.",
  values: () => ({}),
  mods: () => [{ stat: 'attackSpeed', add: PURIFY.attackSpeed }],
  ccImmune: PURIFY.seconds,
};
