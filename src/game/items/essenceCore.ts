import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Luo Yi's Essence Core (see essence.ts). Its own stats are here; Duality Transformation (the altar hero's share
// of stats and items, and its role effects) depends on the hero on her altar, so it's worked out there
// (essenceMods). It exists while a hero is on the altar.
export const ESSENCE_CORE = 'essencecore';
export const ESSENCE_CORE_STATS = {
  hybridAtk: 0.1, // + share of attack and magic attack
  hp: 0.1, // + share of max hp
  enhanced: 0.2, // both, enhanced
};

const text = (n: number) =>
  `+${pct(n)} attack and magic attack, +${pct(n)} max HP. Duality Transformation (unique): holds the essence of the hero on Luo Yi's altar: ` +
  "a share of its stats and its items' stats, and an Enhancement Effect for each of its roles. Only from Commander Luo Yi.";
const mods = (n: number) => [
  { stat: 'atk' as const, pct: n },
  { stat: 'ap' as const, pct: n },
  { stat: 'hp' as const, pct: n },
];

export const essenceCore: ItemDef = {
  id: ESSENCE_CORE,
  name: 'Essence Core',
  icon: '🔶',
  kind: 'utility',
  maxTier: 1,
  exclusive: true,
  desc: text(ESSENCE_CORE_STATS.hybridAtk),
  values: () => ({}),
  mods: () => mods(ESSENCE_CORE_STATS.hybridAtk),
  enhanced: { desc: text(ESSENCE_CORE_STATS.enhanced), mods: () => mods(ESSENCE_CORE_STATS.enhanced) },
};
