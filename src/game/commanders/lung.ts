import { BOARD_COLS, BOARD_ROWS } from '../config';
import { pct } from '../traits/format';
import { list, term } from './terms';
import type { CommanderDef, DuelPower } from './types';

// Tune with `bun run commanders`.
export const LUNG = {
  duel: {
    cell: (BOARD_ROWS - 1) * BOARD_COLS, // the Dueling Ring: the back row's leftmost tile
    seconds: 25, // the duel's limit
    attackSpeed: 1, // + attack speed for the hero in the ring
    perWin: 0.06, // + attack and magic attack for the hero in the ring, per duel won (kept all game)
    maxWins: 11,
  } satisfies DuelPower,
  card: { levels: [4, 5, 7] }, // the same random 4-cost hero at each of these commander levels
};

const d = LUNG.duel;

export const lung: CommanderDef = {
  id: 'lung',
  name: 'Lung',
  icon: '🥋',
  title: 'Master of the Dueling Ring',
  desc:
    `A ${term('duelRing', 'Dueling Ring')} on your back row's leftmost tile. Its hero gets +${pct(d.attackSpeed)} attack speed and duels ` +
    `the farthest enemy every fight; each win gives it +${pct(d.perWin)} attack and magic attack for good.`,
  innate: { duel: LUNG.duel },
  card: {
    name: 'Hidden Disciple',
    icon: '🎎',
    selfDesc: `At commander levels ${LUNG.card.levels.join(', ')}, gain a copy of the same random 4-cost hero (picked now).`,
    self: { levelHero: { levels: LUNG.card.levels, tier: 4 } },
    otherDesc: `At commander levels ${LUNG.card.levels.join(', ')}, gain a copy of the same random 4-cost hero (picked now).`,
    other: { levelHero: { levels: LUNG.card.levels, tier: 4 } },
  },
  terms: {
    duelRing: {
      icon: '🥋',
      title: 'Dueling Ring',
      body: list(
        `The hero in the ring gets +${pct(d.attackSpeed)} attack speed.`,
        'When a fight starts, it drags the farthest enemy into a duel.',
        'The two fight each other alone: basic attacks only, no skills, no mana, and nobody else can touch them.',
        `The duel lasts up to ${d.seconds}s, or until one falls.`,
        `Each duel won: +${pct(d.perWin)} attack and magic attack for the rest of the game, up to ${d.maxWins} times (+${pct(d.perWin * d.maxWins)}).`,
      ),
    },
  },
};
