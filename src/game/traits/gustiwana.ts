import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const GUSTIWANA = {
  defense: [15, 35, 60, 150], // armor and mr for Gustiwana units
  items: {
    pool: ['keris', 'blangkon', 'jimat'],
    grants: [1, 2, 3, 3], // items owned per level, handed out in random order
    shopChance: 0.1, // per shop slot while active: an upgrade card for an owned item
    maxShopTier: 3,
    topLevel: 4, // at Gustiwana 10, every item works at its max tier
  },
};

export const gustiwana: TraitDef = {
  id: 'gustiwana',
  name: 'Gustiwana',
  icon: '🌳',
  kind: 'faction',
  breakpoints: [2, 4, 6, 10],
  desc:
    'Gustiwana units gain +{def} armor and magic resist. Gain {items} exclusive items (random order). ' +
    `While active, shop slots may offer free upgrades for them, up to tier ${GUSTIWANA.items.maxShopTier}; at 10 they work at max tier.`,
  values: () => ({
    def: GUSTIWANA.defense.map(String),
    items: GUSTIWANA.items.grants.map(String),
  }),
  mods: ({ level, member }) =>
    member
      ? [
          { stat: 'armor', add: GUSTIWANA.defense[level - 1] },
          { stat: 'mr', add: GUSTIWANA.defense[level - 1] },
        ]
      : [],
  items: GUSTIWANA.items,
};
