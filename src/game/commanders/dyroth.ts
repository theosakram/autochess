import { roundLabel } from '../config';
import type { AltarPower, CommanderDef } from './types';

// Tune with `bun run balance`.
export const DYROTH = {
  altar: { name: 'Demon Altar', icon: '⚱️', first: 3, every: 4, gifts: 'traits', xp: 2 } satisfies AltarPower,
  // Ready as soon as the card is picked (I-2), then every 3 rounds.
  secondAltar: { name: 'Abyss Altar', icon: '🕳️', first: 2, every: 3, gifts: 'random', xp: 2 } satisfies AltarPower,
};

const a = DYROTH.altar;
const b = DYROTH.secondAltar;

export const dyroth: CommanderDef = {
  id: 'dyroth',
  name: 'Dyroth',
  icon: '👿',
  title: 'Lord of the Demon Altar',
  desc:
    `A ${a.icon} ${a.name} opens beside your board. From round ${roundLabel(a.first)} it earns a use every ${a.every} rounds (unused ones stack). ` +
    `Offer it a hero: it's gone, and you get two 1-star heroes of the next cost up, one sharing its faction and one sharing its role, plus ${a.xp} XP.`,
  innate: { altar: DYROTH.altar },
  card: {
    name: b.name,
    icon: b.icon,
    selfDesc:
      `A second altar, the ${b.icon} ${b.name}, opens beside the first. It earns a use now and every ${b.every} rounds after (unused ones stack): ` +
      `offer it a hero for a random 1-star hero of the next cost up, plus ${b.xp} XP.`,
    self: { secondAltar: DYROTH.secondAltar },
  },
};
