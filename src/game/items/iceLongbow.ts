import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Miya's own item (see commanders/miya.ts). Tune with `bun run balance`.
export const ICE_LONGBOW = {
  attackSpeed: 0.2,
  killHeal: 0.2, // Moonlight: of the healed ally's max hp
  killHealEnhanced: 0.3,
};

const text = (heal: number) =>
  `+${pct(ICE_LONGBOW.attackSpeed)} attack speed. Moonlight (unique): whenever the wearer kills an enemy, the ally with the lowest HP ` +
  `(by share of max HP) heals ${pct(heal)} of its max HP. Only from Commander Miya.`;

export const iceLongbow: ItemDef = {
  id: 'icelongbow',
  name: 'Ice Longbow',
  icon: '🏹',
  kind: 'offense',
  maxTier: 1,
  exclusive: true,
  desc: text(ICE_LONGBOW.killHeal),
  values: () => ({}),
  mods: () => [],
  unique: () => [{ stat: 'attackSpeed', add: ICE_LONGBOW.attackSpeed }],
  killHeal: ICE_LONGBOW.killHeal,
  enhanced: { desc: text(ICE_LONGBOW.killHealEnhanced), killHeal: ICE_LONGBOW.killHealEnhanced },
};
