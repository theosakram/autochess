import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint.
export const SCAVENGER = {
  loot: ['cheapest', 'random'] as const, // which shop unit is taken for free each round
  gold: [1, 2],
};

export const scavenger: TraitDef = {
  id: 'scavenger',
  name: 'Scavenger',
  icon: '🦝',
  kind: 'role',
  breakpoints: [2, 3],
  desc: 'Each round, after the shop refreshes, take the {pick} unit in your shop for free and gain {gold} gold.',
  values: () => ({
    pick: SCAVENGER.loot.map((l) => (l === 'cheapest' ? 'cheapest' : 'random')),
    gold: SCAVENGER.gold.map(String),
  }),
  mods: () => [],
  roundStart: (level) => ({ loot: SCAVENGER.loot[level - 1], gold: SCAVENGER.gold[level - 1] }),
};
