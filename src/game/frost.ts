import { powersOf } from './commanders';
import { rollPrize } from './luckyDice';
import { nextInt } from './rng';
import type { GameState, Player } from './types';

// Aurora (see commanders/aurora.ts): rounds without a hero bought pay out. (The shop's frost is only a look: views.ts.)

const SKIP = ['mirror']; // her power's prizes: heroes, orbs, equipment or gold
const CARD_SKIP = ['mirror', 'factionorb', 'roleorb', 'equipment']; // her card's: a hero or gold

// At round start (state.round already the new round): pays for the round just played if no hero was bought in it.
export function frostRound(state: GameState, p: Player): void {
  const pw = powersOf(p);
  if (!pw.frost && !pw.idlePrize) return;
  const frost = (p.frost ??= { energy: 0, prizes: 0, last: null });
  const idle = state.round > 1 && p.boughtRound !== state.round - 1;
  if (idle && pw.frost) {
    frost.energy += pw.frost.gain;
    if (frost.energy >= pw.frost.need) {
      frost.energy = 0;
      frost.last = prize(state, p, pw.frost.min, pw.frost.max, SKIP);
    }
  }
  const card = pw.idlePrize;
  if (idle && card && frost.prizes < (card.times ?? Infinity)) {
    frost.prizes++;
    frost.last = prize(state, p, card.min, card.max, CARD_SKIP);
  }
}

const prize = (state: GameState, p: Player, min: number, max: number, skip: string[]) => rollPrize(state, p, min + nextInt(state, max - min + 1), skip);
