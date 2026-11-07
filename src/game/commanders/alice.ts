import { roundAt, roundLabel } from '../config';
import { pct } from '../traits/format';
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
    `You get a Blood Pact on rounds ${b.rounds.map(roundLabel).join(', ')} (unused ones wait). Use it on a hero: you get one more copy of it, ` +
    'and from then on its copies pile into that one hero instead of merging three at a time, every copy raising its stats ' +
    `(1 copy 1 star, 3 copies 2 stars, 9 copies 3 stars). Past 3 stars it takes 4 more copies, each +${pct(b.perCopy)} attack, magic attack and max HP ` +
    '(13 copies: 4 red stars). Each Pact goes on a different hero.',
  innate: { bloodPact: ALICE.bloodPact },
  card: {
    name: 'Blood Feast',
    icon: '🍷',
    selfDesc: `Gain ${ALICE.card.xp} XP now. Every hero under your Blood Pact gets +${pct(ALICE.card.hybridAtk)} attack and magic attack.`,
    self: { pickXp: ALICE.card.xp, bloodAtk: ALICE.card.hybridAtk },
  },
};
