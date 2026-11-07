import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment (hybrid). Tune with `bun run balance`.
export const SHEEP_STICK = {
  hybridAtk: 0.15, // + share of attack and magic attack
  hp: 0.1, // + share of max hp
  opening: 3, // seconds: the enemy with the highest star, when the fight starts
  onHit: 1.5, // seconds: its basic attack target
  cooldown: 12, // seconds between on-hit sheep
};

export const sheepStick: ItemDef = {
  id: 'sheepstick',
  name: 'Sheep Stick',
  icon: '🐑',
  kind: 'utility',
  group: 'hybrid',
  maxTier: 1,
  desc:
    `+${pct(SHEEP_STICK.hybridAtk)} attack and magic attack, +${pct(SHEEP_STICK.hp)} max HP. ` +
    `Witchcraft (unique): when a fight starts, turns the enemy with the highest star into a sheep for ${SHEEP_STICK.opening}s ` +
    `(it can't move, attack or cast). Its basic attacks turn their target into a sheep for ${SHEEP_STICK.onHit}s, once every ${SHEEP_STICK.cooldown}s.`,
  values: () => ({}),
  mods: () => [
    { stat: 'atk', pct: SHEEP_STICK.hybridAtk },
    { stat: 'ap', pct: SHEEP_STICK.hybridAtk },
    { stat: 'hp', pct: SHEEP_STICK.hp },
  ],
  sheep: { opening: SHEEP_STICK.opening, onHit: SHEEP_STICK.onHit, cooldown: SHEEP_STICK.cooldown },
};
