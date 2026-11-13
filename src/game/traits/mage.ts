import { pct } from './format';
import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
// Allies get magic attack (adds with item magic attack); Mages also get magic damage, a separate
// multiplier that stacks on top of items instead of being diluted by them.
export const MAGE = {
  allies: [0.1, 0.2, 0.3], // magic attack for every ally, Mages included
  magicDamage: [0.15, 0.3, 0.6], // Mages only: magic damage dealt
};

export const mage: TraitDef = {
  id: 'mage',
  name: 'Mage',
  icon: '✨',
  kind: 'role',
  breakpoints: [2, 4, 6],
  desc: 'All allies gain +{allies} magic attack. Mages also deal +{damage} magic damage.',
  values: () => ({
    allies: MAGE.allies.map(pct),
    damage: MAGE.magicDamage.map(pct),
  }),
  mods: ({ level, member }) => [
    { stat: 'ap', pct: MAGE.allies[level - 1] },
    ...(member ? [{ stat: 'magicAmp' as const, add: MAGE.magicDamage[level - 1] }] : []),
  ],
};
