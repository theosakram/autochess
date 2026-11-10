import { list, term } from './terms';
import type { CommanderDef, FrostPower, IdlePrizePower } from './types';

// Tune with `bun run commanders`. The prizes are Kaela's (luckyDice.ts): the power's without the Mirror Device,
// the card's a hero or gold only (frost.ts).
export const AURORA = {
  frost: { gain: 3, need: 6, min: 8, max: 12 } satisfies FrostPower,
  card: { min: 4, max: 6 } satisfies IdlePrizePower,
  otherTimes: 6, // the card on another commander: at most this many prizes
};

const f = AURORA.frost;
const c = AURORA.card;
const FROST = term('frostEnergy', 'Frost Energy');
const PRIZE = term('frostPrize', 'random prize');
const CARD_PRIZE = term('frostCardPrize', 'random prize');
const cardDesc = (times?: number) =>
  `Each round you buy no hero, gain a ${CARD_PRIZE} worth ${c.min}-${c.max} gold at the start of the next round${times ? ` (up to ${times} times)` : ''}.`;

export const aurora: CommanderDef = {
  id: 'aurora',
  name: 'Aurora',
  icon: '❄️',
  title: 'Queen of the Northern Lights',
  desc:
    `Each round you buy no hero, gain ${f.gain} ${FROST}; ` +
    `at ${f.need}, gain a ${PRIZE} worth ${f.min}-${f.max} gold.`,
  innate: { frost: AURORA.frost },
  card: {
    name: 'Permafrost',
    icon: '🧊',
    selfDesc: cardDesc(),
    self: { idlePrize: AURORA.card },
    otherDesc: cardDesc(AURORA.otherTimes),
    other: { idlePrize: { ...AURORA.card, times: AURORA.otherTimes } },
  },
  terms: {
    frostEnergy: {
      icon: '❄️',
      title: 'Frost Energy',
      body: list(
        'A round is idle if you buy no hero in it. Refreshing, item cards and free heroes are fine.',
        'Your shop looks frozen while the round is still idle.',
        `Each idle round gives ${f.gain} Frost Energy, at the start of the next round.`,
        `At ${f.need}, it turns into a random prize worth ${f.min}-${f.max} gold, and starts again from 0.`,
      ),
    },
    frostPrize: {
      icon: '🎁',
      title: 'Random prize',
      body: list(
        'One prize that fits in its gold worth, topped up with gold.',
        'A random 4- or 5-gold hero, a random faction or role orb, a random equipment, or just gold.',
        "A hero that can't fit on your bench comes as gold instead.",
      ),
    },
    frostCardPrize: {
      icon: '🎁',
      title: 'Random prize',
      body: list(
        'A random 4- or 5-gold hero topped up with gold to its worth, or just gold.',
        "A hero that can't fit on your bench comes as gold instead.",
      ),
    },
  },
};
