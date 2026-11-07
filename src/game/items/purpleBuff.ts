import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment (hybrid). Tune with `bun run balance`.
export const PURPLE_BUFF = {
  hybridAtk: 0.1, // + share of attack and magic attack
  castMana: 10, // Elemental Power: mana after each skill cast
};

export const purpleBuff: ItemDef = {
  id: 'purplebuff',
  name: 'Purple Buff',
  icon: '🟣',
  kind: 'utility',
  group: 'hybrid',
  maxTier: 1,
  desc: `+${pct(PURPLE_BUFF.hybridAtk)} attack and magic attack. Elemental Power (unique): gains ${PURPLE_BUFF.castMana} mana after casting a skill.`,
  values: () => ({}),
  mods: () => [
    { stat: 'atk', pct: PURPLE_BUFF.hybridAtk },
    { stat: 'ap', pct: PURPLE_BUFF.hybridAtk },
  ],
  castMana: PURPLE_BUFF.castMana,
};
