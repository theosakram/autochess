import { pct } from '../traits/format';
import type { CommanderDef } from './types';

// Tune with `bun run commanders`.
export const GUINESS = {
  freeHeroChance: 0.24, // after each fight's free shop refresh: one hero in it is free
  startChests: 1,
  card: { rounds: 15 }, // a free hero in every one of the next this-many after-fight shops
};

export const guiness: CommanderDef = {
  id: 'guiness',
  name: 'Guiness',
  icon: '🍺',
  title: 'The Lucky Brewer',
  desc:
    `Start with ${GUINESS.startChests} Equipment Chest. After every fight, when your shop refreshes for free, ` +
    `there's a ${pct(GUINESS.freeHeroChance)} chance one hero in it is free (0 gold).`,
  innate: { freeHeroChance: GUINESS.freeHeroChance, startChests: GUINESS.startChests },
  card: {
    name: 'On the House',
    icon: '🎟️',
    selfDesc: `For the next ${GUINESS.card.rounds} rounds, every free shop refresh has one free hero in it.`,
    self: { pickFreeHeroes: GUINESS.card.rounds },
  },
};
