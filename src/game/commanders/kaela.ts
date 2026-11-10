import { roundAt, roundLabel } from '../config';
import { list, term } from './terms';
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
    `A Treasure Grove grows beside your board. Roll the ${term('luckyDice', 'Lucky Dice')} every round to build up points, ` +
    `then open the Trove to cash them in for a prize, up to ${t.opens} times a game.`,
  innate: { trove: KAELA.trove },
  card: {
    name: 'Lucky Streak',
    icon: '🍀',
    selfDesc:
      `The Lucky Dice roll for you twice, apart from the Trove: now (round ${roundLabel(KAELA.rolls[0].round)}) and on round ${roundLabel(KAELA.rolls[1].round)}, ` +
      `each paying a random prize. ${KAELA.rolls[0].min + KAELA.rolls[1].min}-${KAELA.rolls[0].max + KAELA.rolls[1].max} gold worth in all.`,
    self: { luckyRolls: KAELA.rolls },
    otherDesc:
      `The Lucky Dice roll for you twice: now (round ${roundLabel(KAELA.rolls[0].round)}) and on round ${roundLabel(KAELA.rolls[1].round)}, ` +
      `each paying a random prize. ${KAELA.rolls[0].min + KAELA.rolls[1].min}-${KAELA.rolls[0].max + KAELA.rolls[1].max} gold worth in all.`,
    other: { luckyRolls: KAELA.rolls },
  },
  terms: {
    luckyDice: {
      icon: '🎲',
      title: 'Lucky Dice',
      body:
        list(
          'You get one roll every round. Unused rolls carry over.',
          `Each roll adds 1 to ${t.die} points. Going past ${t.max} drops you back to 0.`,
          'Open the Trove to cash in your points for a prize: gold, a hero, an orb, a Mirror Device or equipment.',
          `Up to ${t.opens} Trove opens a game.`,
        ) +
        `<table class="bonus-table"><tbody><tr><td>Points</td>${t.value.slice(1).map((_, i) => `<td class="bonus-val">${i + 1}</td>`).join('')}</tr>` +
        `<tr><td>Prize (gold worth)</td>${t.value.slice(1).map((v) => `<td>${v}</td>`).join('')}</tr></tbody></table>`,
    },
  },
};
