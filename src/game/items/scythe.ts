import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Ruby's own item (see commanders/ruby.ts). Tune with `bun run balance`.
export const SCYTHE = {
  hybridAtk: 0.2, // + share of attack and magic attack
  every: 2, // Hunt: seconds between strikes
  mult: 2.6, // x the higher of attack and magic attack, physical
  fury: 0.55, // + share of attack and magic attack once an ally's Cloak revives it
};

export const scythe: ItemDef = {
  id: 'scythe',
  name: 'Scythe',
  icon: '🌾',
  kind: 'offense',
  maxTier: 1,
  exclusive: true,
  desc:
    `+${pct(SCYTHE.hybridAtk)} attack and magic attack. Hunt (unique): every ${SCYTHE.every}s, strikes the enemy with your Cloak's Rage Mark, wherever it is, ` +
    `for ${pct(SCYTHE.mult)} of the wearer's higher attack or magic attack as physical damage. ` +
    `When your Cloak's wearer gets back up, the Scythe's wearer gains +${pct(SCYTHE.fury)} attack and magic attack for the rest of the fight. Only from Commander Ruby.`,
  values: () => ({}),
  mods: () => [
    { stat: 'atk', pct: SCYTHE.hybridAtk },
    { stat: 'ap', pct: SCYTHE.hybridAtk },
  ],
  hunt: { effect: 'hunt', every: SCYTHE.every, mult: SCYTHE.mult, fury: SCYTHE.fury },
};
