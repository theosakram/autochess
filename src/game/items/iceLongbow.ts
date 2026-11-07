import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Miya's own item (see commanders/miya.ts). Tune with `bun run balance`.
export const ICE_LONGBOW = {
  attackSpeed: 0.3,
  killHeal: 0.2, // of the healed ally's max hp
};

export const iceLongbow: ItemDef = {
  id: 'icelongbow',
  name: 'Ice Longbow',
  icon: '🏹',
  kind: 'offense',
  maxTier: 1,
  exclusive: true,
  desc:
    `+${pct(ICE_LONGBOW.attackSpeed)} attack speed. Frost Mercy (unique): whenever the wearer kills an enemy, the ally with the lowest HP ` +
    `(by share of max HP) heals ${pct(ICE_LONGBOW.killHeal)} of its max HP. Only from Commander Miya.`,
  values: () => ({}),
  mods: () => [],
  unique: () => [{ stat: 'attackSpeed', add: ICE_LONGBOW.attackSpeed }],
  killHeal: ICE_LONGBOW.killHeal,
};
