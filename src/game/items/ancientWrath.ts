import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment (defense). Tune with `bun run balance`.
export const ANCIENT_WRATH = {
  hp: 0.15, // + share of max hp
  radius: 1, // Provocation: at the start, the enemy in front of it and those within this many cells of that one are taunted
  seconds: 2, // taunt length
  perTargeter: 10, // armor and magic resist each, per enemy going after the holder
  perTargeterEnhanced: 18,
};

const text = (per: number) =>
  `+${pct(ANCIENT_WRATH.hp)} max HP. Provocation (unique): when a fight starts, taunts the enemy in front of it and enemies within ` +
  `${ANCIENT_WRATH.radius} cell of that one for ${ANCIENT_WRATH.seconds}s. The holder has +${per} armor and magic resist for each enemy targeting it.`;
const provoke = (perTargeter: number) => ({ effect: 'provocation', radius: ANCIENT_WRATH.radius, seconds: ANCIENT_WRATH.seconds, perTargeter });

export const ancientWrath: ItemDef = {
  id: 'ancientwrath',
  name: 'Ancient Wrath',
  icon: '👹',
  kind: 'defense',
  group: 'armor',
  maxTier: 1,
  desc: text(ANCIENT_WRATH.perTargeter),
  values: () => ({}),
  mods: () => [{ stat: 'hp', pct: ANCIENT_WRATH.hp }],
  provoke: provoke(ANCIENT_WRATH.perTargeter),
  enhanced: { desc: text(ANCIENT_WRATH.perTargeterEnhanced), provoke: provoke(ANCIENT_WRATH.perTargeterEnhanced) },
};
