import { roundLabel } from '../config';
import { list, term } from './terms';
import type { AltarPower, CommanderDef } from './types';

// Tune with `bun run balance`.
export const DYROTH = {
  altar: { name: 'Greater Demon Altar', icon: '⚱️', first: 3, every: 4, gifts: 'traits', xp: 2 } satisfies AltarPower,
  // Ready as soon as the card is picked (I-2), then every 3 rounds.
  secondAltar: { name: 'Abyss Altar', icon: '🕳️', first: 2, every: 3, gifts: 'random', xp: 2 } satisfies AltarPower,
};

const a = DYROTH.altar;
const b = DYROTH.secondAltar;

const ABYSS = term('abyssAltar', `${b.icon} ${b.name}`);

export const dyroth: CommanderDef = {
  id: 'dyroth',
  name: 'Dyroth',
  icon: '👿',
  title: 'Lord of the Greater Demon Altar',
  desc:
    `A ${term('demonAltar', `${a.icon} ${a.name}`)} opens beside your board, earning a use every ${a.every} rounds. ` +
    `Offer it a 1-star hero for two heroes of the next cost up, plus ${a.xp} XP.`,
  innate: { altar: DYROTH.altar },
  card: {
    name: b.name,
    icon: b.icon,
    selfDesc: `A second altar, the ${ABYSS}, opens beside the first: offer it a 1-star hero for a random one of the next cost up.`,
    self: { secondAltar: DYROTH.secondAltar },
    otherDesc: `The ${ABYSS} opens beside your board: offer it a 1-star hero for a random one of the next cost up.`,
    other: { altar: DYROTH.secondAltar },
  },
  terms: {
    demonAltar: {
      icon: a.icon,
      title: a.name,
      body: list(
        `Earns its first use on round ${roundLabel(a.first)}, then one every ${a.every} rounds. Unused uses stack.`,
        "Offer it a 1-star hero: that hero is gone.",
        'You get two 1-star heroes of the next cost up: one sharing its faction, one sharing its role.',
        `Plus ${a.xp} XP.`,
      ),
    },
    abyssAltar: {
      icon: b.icon,
      title: b.name,
      body: list(
        `Earns a use as soon as you get it, then one every ${b.every} rounds. Unused uses stack.`,
        "Offer it a 1-star hero: that hero is gone.",
        'You get a random 1-star hero of the next cost up.',
        `Plus ${b.xp} XP.`,
      ),
    },
  },
};
