import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment (defense). Tune with `bun run balance`.
export const GUARDIAN_HELMET = {
  hp: 0.15, // + share of max hp
  regen: 0.015, // Recovery: share of max hp healed every second
};

export const guardianHelmet: ItemDef = {
  id: 'guardianhelmet',
  name: 'Guardian Helmet',
  icon: '⛑️',
  kind: 'defense',
  group: 'armor',
  maxTier: 1,
  desc: `+${pct(GUARDIAN_HELMET.hp)} max HP. Recovery (unique): heals ${pct(GUARDIAN_HELMET.regen)} of its max HP every second.`,
  values: () => ({}),
  mods: () => [{ stat: 'hp', pct: GUARDIAN_HELMET.hp }],
  regen: GUARDIAN_HELMET.regen,
};
