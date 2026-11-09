import { roundAt, roundLabel } from '../config';
import type { CommanderDef } from './types';

// Tune with `bun run commanders`. Gloves: see gloves.ts.
export const PACQUIAO = {
  gloveRounds: [
    { round: roundAt(2, 1), glove: 'glove3' },
    { round: roundAt(3, 1), glove: 'glove4' },
    { round: roundAt(4, 1), glove: 'glove5' },
  ],
  card: { glove: 'glory' },
};

const tiers = PACQUIAO.gloveRounds.map(({ round, glove }) => `a Tier-${glove.slice(-1)} glove on ${roundLabel(round)}`).join(', ');

export const pacquiao: CommanderDef = {
  id: 'pacquiao',
  name: 'Pacquiao',
  icon: '🥊',
  title: 'The People\'s Champ',
  desc:
    `Boxing gloves: ${tiers}. Use one on a hero of that cost to gain 2 1★ copies of it, whatever the shop has left ` +
    "(selling them doesn't put them back in the shop).",
  innate: { gloveRounds: PACQUIAO.gloveRounds },
  card: {
    name: 'Glory Glove',
    icon: '🏆',
    selfDesc:
      "Gain the Glory Glove: use it on a hero costing 3 or less to gain 2 1★ copies of it, whatever the shop has left (selling them doesn't put them back in the shop).",
    self: { pickGloves: [PACQUIAO.card.glove] },
  },
};
