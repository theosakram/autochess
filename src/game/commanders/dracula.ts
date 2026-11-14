import { roundAt, roundLabel } from '../config';
import { list, term } from './terms';
import type { CommanderDef, DemonAltarPower } from './types';

// Tune with `bun run commanders`. The rewards and activations: demonAltar.ts.
export const DRACULA = {
  altar: { rounds: [roundAt(1, 3), roundAt(2, 3), roundAt(3, 3)] } satisfies DemonAltarPower, // I-3, II-3, III-3
  card: { rounds: [roundAt(1, 2), roundAt(2, 2), roundAt(3, 2)] } satisfies DemonAltarPower, // I-2, II-2, III-2
};

const ALTAR = term('draculaAltar', 'Demon Altar');
const rounds = (r: number[]) => r.map(roundLabel).join(', ');
const cardDesc = `Summon a second ${ALTAR}, with its own 6 rewards. It gains an activation on ${rounds(DRACULA.card.rounds)}.`;

export const dracula: CommanderDef = {
  id: 'dracula',
  name: 'Dracula',
  icon: '🦇',
  title: 'Lord of the Night',
  desc: `Summon a ${ALTAR} holding 6 rewards (2 blue, 2 purple, 2 gold). It gains an activation on ${rounds(DRACULA.altar.rounds)}.`,
  innate: { demonAltar: DRACULA.altar },
  card: {
    name: 'Twin Altars',
    icon: '🩸',
    selfDesc: cardDesc,
    self: { demonAltarCard: DRACULA.card },
    // The same for anyone else (not his own altar).
    otherDesc: `Summon a ${ALTAR} holding 6 rewards (2 blue, 2 purple, 2 gold). It gains an activation on ${rounds(DRACULA.card.rounds)}.`,
    other: { demonAltarCard: DRACULA.card },
  },
  terms: {
    draculaAltar: {
      icon: '😈',
      title: 'Demon Altar',
      body:
        list(
          'Activations stack. To activate, pick a reward to discard: you get one of the others at random. Both leave the altar, so 3 activations empty it.',
          'Blue: 6 gold, 7 XP, 2 random 2-gold heroes, a random 2★ 1-gold hero, 4 random 1-gold heroes, or an Equipment Chest.',
          'Purple: 10 gold, 12 XP, 3 random 3-gold heroes, 2 random 4-gold heroes, or an Enhanced Equipment Chest (choose 1 of 3 enhanced equipment).',
          'Gold: 15 gold, a faction orb (choose 1 of 3), a role orb (choose 1 of 3), 2 random 5-gold heroes, or a Mirror Device.',
        ) + '<p>A hero with no room on your bench or board (or none left in the pool) pays its cost in gold instead.</p>',
    },
  },
};
