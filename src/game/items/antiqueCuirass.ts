import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Equipment (defense). Tune with `bun run balance`.
export const ANTIQUE_CUIRASS = {
  hp: 0.1, // + share of max hp
  reduction: 0.1, // less damage taken
  perStack: 0.04, // Deter: attack and magic attack taken off the attacker, per stack
  max: 5,
  seconds: 3,
  enhanced: { perStack: 0.07, seconds: 4 },
};

const text = (per: number, seconds: number) =>
  `+${pct(ANTIQUE_CUIRASS.hp)} max HP, ${pct(ANTIQUE_CUIRASS.reduction)} damage reduction. ` +
  `Deter (unique): an enemy that damages the holder loses ${pct(per)} attack and magic attack for ${seconds}s, ` +
  `stacking up to ${ANTIQUE_CUIRASS.max} times.`;
const deter = (perStack: number, seconds: number) => ({ effect: 'deter', perStack, max: ANTIQUE_CUIRASS.max, seconds });

export const antiqueCuirass: ItemDef = {
  id: 'antiquecuirass',
  name: 'Antique Cuirass',
  icon: '🛡️',
  kind: 'defense',
  group: 'armor',
  maxTier: 1,
  desc: text(ANTIQUE_CUIRASS.perStack, ANTIQUE_CUIRASS.seconds),
  values: () => ({}),
  mods: () => [
    { stat: 'hp', pct: ANTIQUE_CUIRASS.hp },
    { stat: 'damageTaken', add: -ANTIQUE_CUIRASS.reduction },
  ],
  deter: deter(ANTIQUE_CUIRASS.perStack, ANTIQUE_CUIRASS.seconds),
  enhanced: {
    desc: text(ANTIQUE_CUIRASS.enhanced.perStack, ANTIQUE_CUIRASS.enhanced.seconds),
    deter: deter(ANTIQUE_CUIRASS.enhanced.perStack, ANTIQUE_CUIRASS.enhanced.seconds),
  },
};
