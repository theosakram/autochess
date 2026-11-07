import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment (defense). Tune with `bun run balance`.
export const ANTIQUE_CUIRASS = {
  hp: 0.1, // + share of max hp
  reduction: 0.1, // less damage taken
  perStack: 0.04, // Deter: attack and magic attack taken off the attacker, per stack
  max: 5,
  seconds: 3,
};

export const antiqueCuirass: ItemDef = {
  id: 'antiquecuirass',
  name: 'Antique Cuirass',
  icon: '🛡️',
  kind: 'defense',
  group: 'armor',
  maxTier: 1,
  desc:
    `+${pct(ANTIQUE_CUIRASS.hp)} max HP, ${pct(ANTIQUE_CUIRASS.reduction)} damage reduction. ` +
    `Deter (unique): an enemy that damages the holder loses ${pct(ANTIQUE_CUIRASS.perStack)} attack and magic attack for ${ANTIQUE_CUIRASS.seconds}s, ` +
    `stacking up to ${ANTIQUE_CUIRASS.max} times.`,
  values: () => ({}),
  mods: () => [
    { stat: 'hp', pct: ANTIQUE_CUIRASS.hp },
    { stat: 'damageTaken', add: -ANTIQUE_CUIRASS.reduction },
  ],
  deter: { effect: 'deter', perStack: ANTIQUE_CUIRASS.perStack, max: ANTIQUE_CUIRASS.max, seconds: ANTIQUE_CUIRASS.seconds },
};
