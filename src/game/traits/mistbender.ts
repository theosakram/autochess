import type { TraitDef } from './types';

// Per level, index 0 = first breakpoint. Tune with `bun run balance`.
export const MISTBENDER = {
  coinsPerSkill: [1, 2], // Mist coins every time a Mistbender uses its skill
  maxCoins: 200, // spend them
};

export const mistbender: TraitDef = {
  id: 'mistbender',
  name: 'Mistbender',
  icon: '🌫️',
  kind: 'faction',
  breakpoints: [1, 3], // a single Mistbender already earns coins
  desc: 'Fielding any Mistbender opens the Mist Shop beside the board. Every time a Mistbender uses its skill, gain {coins} Mist coins.',
  values: () => ({ coins: MISTBENDER.coinsPerSkill.map(String) }),
  mods: () => [],
  stacks: {
    label: 'Mist coins',
    max: MISTBENDER.maxCoins,
    perFight: (level, fight) => MISTBENDER.coinsPerSkill[level - 1] * fight.memberSkills,
  },
  sideShop: { title: 'Mist Shop' },
};
