import { pct } from '../traits/format';
import type { ItemDef } from './types';

// Per tier, index 0 = tier 1.
export const KERIS = {
  attack: 0.2, // every tier, physical and magic attack
  mortalStrike: [0.08, 0.15, 0.2, 1], // of the holder's attack, pure damage to every enemy
  every: 5, // seconds
};

export const keris: ItemDef = {
  id: 'keris',
  name: 'Keris',
  icon: '🗡️',
  kind: 'offense',
  trait: 'gustiwana',
  maxTier: 4,
  desc: `+${pct(KERIS.attack)} attack and magic attack. Mortal Strike: every ${KERIS.every}s, hits all enemies for {strike} of attack as pure damage.`,
  values: () => ({ strike: KERIS.mortalStrike.map(pct) }),
  mods: () => [
    { stat: 'atk', pct: KERIS.attack },
    { stat: 'ap', pct: KERIS.attack },
  ],
  pulse: (tier) => ({ every: KERIS.every, atkPct: KERIS.mortalStrike[tier - 1], damageType: 'pure' }),
};
