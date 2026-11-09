import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment (hybrid). Tune with `bun run balance`.
export const PURPLE_BUFF = {
  hybridAtk: 0.1, // + share of attack and magic attack
  castMana: 10, // Elemental Power: mana after each skill cast
  hybridAtkEnhanced: 0.3,
};

const text = (atk: number) => `+${pct(atk)} attack and magic attack. Elemental Power (unique): gains ${PURPLE_BUFF.castMana} mana after casting a skill.`;
const hybrid = (atk: number) => [
  { stat: 'atk' as const, pct: atk },
  { stat: 'ap' as const, pct: atk },
];

export const purpleBuff: ItemDef = {
  id: 'purplebuff',
  name: 'Purple Buff',
  icon: '🟣',
  kind: 'utility',
  group: 'hybrid',
  maxTier: 1,
  desc: text(PURPLE_BUFF.hybridAtk),
  values: () => ({}),
  mods: () => hybrid(PURPLE_BUFF.hybridAtk),
  castMana: PURPLE_BUFF.castMana,
  enhanced: { desc: text(PURPLE_BUFF.hybridAtkEnhanced), mods: () => hybrid(PURPLE_BUFF.hybridAtkEnhanced) },
};
