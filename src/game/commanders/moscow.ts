import { list, term } from './terms';
import type { CommanderDef, LadderPower, RitualPower } from './types';

// Tune with `bun run commanders`. The altar, the charge and the card's heroes: ritual.ts.
export const MOSCOW = {
  ritual: { costs: [1, 2, 3, 4], copies: 2 } satisfies RitualPower,
  card: { tiers: [1, 2, 3, 4, 5] } satisfies LadderPower,
  cardGold: 5,
};

const r = MOSCOW.ritual;
const RITUAL = term('shadowRitual', 'ritual');
const CHARGE = term('shadowCharge', 'Shadow charge');
const ladderDesc =
  `Gain ${MOSCOW.cardGold} gold and a random ${MOSCOW.card.tiers[0]}-gold hero now, then a random hero of each cost up ` +
  `(${MOSCOW.card.tiers.slice(1).join(', ')} gold) at the start of each following round.`;

export const moscow: CommanderDef = {
  id: 'moscow',
  name: 'Moscow',
  icon: '🕯️',
  title: 'Keeper of the Shadow Altar',
  desc:
    `Raises a Shadow Altar that asks for ${r.costs.length} heroes, one of each cost (${r.costs.join(', ')} gold), picked at random. ` +
    `Offer them all to finish the ${RITUAL} and gain a ${CHARGE}: use it on a hero to gain ${r.copies} more copies of it.`,
  innate: { ritual: MOSCOW.ritual },
  card: {
    name: 'Shadow Procession',
    icon: '🌘',
    selfDesc: ladderDesc,
    self: { ladder: MOSCOW.card, pickGold: MOSCOW.cardGold },
    otherDesc: ladderDesc,
    other: { ladder: MOSCOW.card, pickGold: MOSCOW.cardGold },
  },
  terms: {
    shadowRitual: {
      icon: '🌑',
      title: 'Shadow Ritual',
      body: list(
        `The altar names ${r.costs.length} heroes at random when you start, one of each cost: ${r.costs.map((c) => `${c} gold`).join(', ')}.`,
        'Offer any copy of a named hero, from the board or bench, in any order. It is gone: its copies go back to the pool, its items to your inventory.',
        `Once all ${r.costs.length} are offered, the ritual ends: you gain a Shadow charge, and the altar takes no more offerings.`,
      ),
    },
    shadowCharge: {
      icon: '🌑',
      title: 'Shadow charge',
      body: list(
        `Use it on any hero you own: you gain ${r.copies} 1-star copies of it, made from nothing (the pool and shop don't matter).`,
        `On a lone 1-star hero that's 3 copies: it turns 2-star at once, even a 5-gold one.`,
        'Selling those copies gives gold as usual but puts nothing back in the pool.',
      ),
    },
  },
};
