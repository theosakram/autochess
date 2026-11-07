import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment (defense). Tune with `bun run balance`.
export const THUNDER_BELT = {
  defense: 30, // armor and magic resist each (single-stat defense items give 50)
  every: 3, // Power of Thunder: seconds between charges (charged when the fight starts)
  share: 0.08, // of the holder's max hp, magic damage
  radius: 1, // enemies within this many cells of the target are hit too
};

export const thunderBelt: ItemDef = {
  id: 'thunderbelt',
  name: 'Thunder Belt',
  icon: '⚡',
  kind: 'defense',
  group: 'armor',
  maxTier: 1,
  desc:
    `+${THUNDER_BELT.defense} armor and magic resist. ` +
    `Power of Thunder (unique): every ${THUNDER_BELT.every}s, the next basic attack also deals magic damage equal to ${pct(THUNDER_BELT.share)} ` +
    `of the holder's max HP to the target and enemies next to it.`,
  values: () => ({}),
  mods: () => [
    { stat: 'armor', add: THUNDER_BELT.defense },
    { stat: 'mr', add: THUNDER_BELT.defense },
  ],
  thunder: { effect: 'thunder', every: THUNDER_BELT.every, share: THUNDER_BELT.share, radius: THUNDER_BELT.radius },
};
