import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment (defense). Tune with `bun run balance`.
export const ANCIENT_WRATH = {
  hp: 0.15, // + share of max hp
  radius: 2, // Provocation: enemies within this many cells are taunted when the fight starts
  seconds: 2, // taunt length
  perTargeter: 10, // armor and magic resist each, per enemy going after the holder
};

export const ancientWrath: ItemDef = {
  id: 'ancientwrath',
  name: 'Ancient Wrath',
  icon: '👹',
  kind: 'defense',
  group: 'armor',
  maxTier: 1,
  desc:
    `+${pct(ANCIENT_WRATH.hp)} max HP. Provocation (unique): when a fight starts, taunts enemies within ${ANCIENT_WRATH.radius} cells ` +
    `for ${ANCIENT_WRATH.seconds}s. The holder has +${ANCIENT_WRATH.perTargeter} armor and magic resist for each enemy targeting it.`,
  values: () => ({}),
  mods: () => [{ stat: 'hp', pct: ANCIENT_WRATH.hp }],
  provoke: { effect: 'provocation', radius: ANCIENT_WRATH.radius, seconds: ANCIENT_WRATH.seconds, perTargeter: ANCIENT_WRATH.perTargeter },
};
