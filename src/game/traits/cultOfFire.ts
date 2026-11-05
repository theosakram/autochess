import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const CULT_OF_FIRE = {
  defense: [15, 30, 50, 150], // armor and mr for Cult of Fire units
};

export const cultOfFire: TraitDef = {
  id: 'cultoffire',
  name: 'Cult of Fire',
  icon: '🔥',
  kind: 'faction',
  breakpoints: [2, 4, 6, 10],
  desc:
    'Cult of Fire units gain +{def} armor and magic resist. Grants the Pyre Offering: ' +
    'give it to a unit outside the cult, and every cultist gains a share of that unit’s attack.',
  values: () => ({ def: CULT_OF_FIRE.defense.map(String) }),
  mods: ({ level, member }) =>
    member
      ? [
          { stat: 'armor', add: CULT_OF_FIRE.defense[level - 1] },
          { stat: 'mr', add: CULT_OF_FIRE.defense[level - 1] },
        ]
      : [],
  items: { pool: ['offering'], grants: [1, 1, 1, 1], shopChance: 0, maxShopTier: 1 },
};
