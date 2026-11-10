import { roundAt, roundLabel } from '../config';
import { pct } from '../traits/format';
import { list, term } from './terms';
import type { BloodPower, CommanderDef } from './types';

// Tune with `bun run balance`.
export const ALICE = {
  bloodPact: { rounds: [roundAt(1, 1), roundAt(2, 1), roundAt(3, 1)], perCopy: 0.1 } satisfies BloodPower,
  card: { xp: 10, hybridAtk: 0.4 },
};

const b = ALICE.bloodPact;

export const alice: CommanderDef = {
  id: 'alice',
  name: 'Alice',
  icon: '🧛',
  title: 'The Crimson Countess',
  desc:
    `You get a ${term('bloodPact', 'Blood Pact')} on rounds ${b.rounds.map(roundLabel).join(', ')} (unused ones wait). Use it on a hero: ` +
    'you get one more copy, and from then on its copies pile into that one hero, up to 4 red stars.',
  innate: { bloodPact: ALICE.bloodPact },
  card: {
    name: 'Blood Feast',
    icon: '🍷',
    selfDesc: `Gain ${ALICE.card.xp} XP now. Every hero under your Blood Pact gets +${pct(ALICE.card.hybridAtk)} attack and magic attack.`,
    self: { pickXp: ALICE.card.xp, bloodAtk: ALICE.card.hybridAtk },
  },
  terms: {
    bloodPact: {
      icon: '🩸',
      title: 'Blood Pact',
      body:
        list(
          'Use it on a hero: you get one more copy of it.',
          'From then on its copies pile into that one hero instead of merging three at a time, every copy raising its stats.',
          `Past 3 stars, each of 4 more copies gives +${pct(b.perCopy)} attack, magic attack and max HP.`,
          'Each Pact goes on a different hero.',
        ) +
        '<table class="bonus-table"><tbody><tr><td>Copies</td><td class="bonus-val">1</td><td class="bonus-val">3</td><td class="bonus-val">9</td><td class="bonus-val">13</td></tr>' +
        '<tr><td>Stars</td><td>1★</td><td>2★</td><td>3★</td><td>4 red ★</td></tr></tbody></table>',
    },
  },
};
