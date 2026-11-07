import { roundAt, roundLabel } from '../config';
import type { CommanderDef, TrovePower } from './types';

// Tune with `bun run balance`.
export const KAELA = {
  trove: { die: 4, max: 8, opens: 3, value: [0, 2, 3, 5, 6, 8, 10, 12, 16] } satisfies TrovePower,
  // The card's two rolls, on I-2 and III-1: 21-35 gold worth in all.
  rolls: [
    { round: roundAt(1, 2), min: 10, max: 17 },
    { round: roundAt(3, 1), min: 11, max: 18 },
  ],
};

const t = KAELA.trove;

export const kaela: CommanderDef = {
  id: 'kaela',
  name: 'Kaela',
  icon: '🎲',
  title: 'Keeper of the Treasure Grove',
  desc:
    `A Treasure Grove grows beside your board. Once a round, roll the Lucky Dice there for 1 to ${t.die} points; ` +
    `going past ${t.max} drops you back to 0. Open the Trove to cash in your points for a prize ` +
    `(${t.max} points: ${t.value[t.max]} gold worth: gold, a hero, an orb, a Mirror Device or equipment); up to ${t.opens} times a game.`,
  innate: { trove: KAELA.trove },
  card: {
    name: 'Lucky Streak',
    icon: '🍀',
    selfDesc:
      `The Lucky Dice roll for you twice, apart from the Trove: now (round ${roundLabel(KAELA.rolls[0].round)}) and on round ${roundLabel(KAELA.rolls[1].round)}, ` +
      `each paying a random prize. ${KAELA.rolls[0].min + KAELA.rolls[1].min}-${KAELA.rolls[0].max + KAELA.rolls[1].max} gold worth in all.`,
    self: { luckyRolls: KAELA.rolls },
  },
};
