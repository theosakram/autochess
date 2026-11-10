import { roundAt, roundLabel } from '../config';
import { pct } from '../traits/format';
import { list, term } from './terms';
import type { BloodPower, CommanderDef } from './types';

// Tune with `bun run balance`.
export const ALICE = {
  // perCopy by current star: 1★ share of the way to 2★; 2★ +share of its 3★ stats (kept at 3★); 3★ +share of its stats.
  bloodPact: { rounds: [roundAt(1, 1), roundAt(2, 1), roundAt(3, 1)], perCopy: [0.5, 0.08, 0.1] } satisfies BloodPower,
  card: { xp: 5, hybridAtk: 0.35 },
};

const b = ALICE.bloodPact;
const [p1, p2, p3] = b.perCopy;

export const alice: CommanderDef = {
  id: 'alice',
  name: 'Alice',
  icon: '🧛',
  title: 'The Crimson Countess',
  desc:
    `You get a ${term('bloodPact', 'Blood Pact')} on rounds ${b.rounds.map(roundLabel).join(', ')} (unused ones wait). Use it on a hero: ` +
    'it no longer needs three copies to star up; every copy you get raises its stats instead, up to 4 red stars.',
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
          'Use it on a hero: from then on its copies pile into that one hero instead of merging three at a time.',
          `At 1 star, each copy brings it ${pct(p1)} of the way to its 2-star stats.`,
          `At 2 stars, each copy adds ${pct(p2)} of its 3-star stats, and it keeps those bonuses at 3 stars.`,
          `At 3 stars, each of 4 more copies gives +${pct(p3)} attack, magic attack and max HP on top.`,
          'Each Pact goes on a different hero.',
        ) +
        '<table class="bonus-table"><tbody><tr><td>Copies</td><td class="bonus-val">1</td><td class="bonus-val">3</td><td class="bonus-val">9</td><td class="bonus-val">13</td></tr>' +
        '<tr><td>Stars</td><td>1★</td><td>2★</td><td>3★</td><td>4 red ★</td></tr></tbody></table>',
    },
  },
};
