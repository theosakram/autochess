import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment (defense). Tune with `bun run balance`.
export const DOMINANCE_ICE = {
  mr: 50,
  hp: 0.1, // + share of max hp
  radius: 2, // Arctic Cold: enemies within this many cells
  slow: 0.2, // attack speed taken off them
  linger: 1, // seconds the slow stays after an enemy leaves the radius (or the holder dies)
  hurtMana: 0.25, // + share of the mana gained from taking hits
};

export const dominanceIce: ItemDef = {
  id: 'dominanceice',
  name: 'Dominance Ice',
  icon: '🏔️',
  kind: 'defense',
  group: 'armor',
  maxTier: 1,
  desc:
    `+${DOMINANCE_ICE.mr} magic resist, +${pct(DOMINANCE_ICE.hp)} max HP. ` +
    `Arctic Cold (unique): enemies within ${DOMINANCE_ICE.radius} cells have ${pct(DOMINANCE_ICE.slow)} less attack speed, ` +
    `and the holder gains ${pct(DOMINANCE_ICE.hurtMana)} more mana from taking hits.`,
  values: () => ({}),
  mods: () => [
    { stat: 'mr', add: DOMINANCE_ICE.mr },
    { stat: 'hp', pct: DOMINANCE_ICE.hp },
  ],
  chill: { effect: 'arcticcold', radius: DOMINANCE_ICE.radius, attackSpeed: DOMINANCE_ICE.slow, linger: DOMINANCE_ICE.linger },
  hurtMana: DOMINANCE_ICE.hurtMana,
};
