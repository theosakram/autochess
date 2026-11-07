import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Per tier, index 0 = tier 1.
export const KERIS = {
  attack: 0.2, // every tier, physical and magic attack
  // Justice (unique): every `every` seconds, strikes the 3x3 with the most enemies.
  justice: [0.08, 0.15, 0.2, 1], // of the holder's attack, pure damage to each enemy in it
  every: 5, // seconds
};

export const keris: ItemDef = {
  id: 'keris',
  name: 'Keris',
  icon: '🗡️',
  kind: 'offense',
  trait: 'gustiwana',
  membersOnly: true,
  maxTier: 4,
  desc:
    `+${pct(KERIS.attack)} attack and magic attack. Justice (unique): every ${KERIS.every}s, strikes the 3×3 with the most ` +
    'enemies, dealing {strike} of attack as pure damage to each enemy in it.',
  values: () => ({ strike: KERIS.justice.map(pct) }),
  mods: () => [
    { stat: 'atk', pct: KERIS.attack },
    { stat: 'ap', pct: KERIS.attack },
  ],
  pulse: (tier) => ({ every: KERIS.every, atkPct: KERIS.justice[tier - 1], damageType: 'pure', area: '3x3' }),
};
