import type { CommanderDef } from './types';

// Tune with `bun run balance`.
export const LANCE = {
  // Bonus gold at the end of every round, by stage (I, II, III and later).
  stageGold: [4, 5, 6],
  card: { level: 5, gold: 2 },
};

export const lance: CommanderDef = {
  id: 'lance',
  name: 'Lance',
  icon: '🏇',
  title: 'Knight of Ambition',
  desc:
    `No interest. Every round end pays +${LANCE.stageGold.join('/')} bonus gold (stage I/II/III and later). ` +
    'But when a round ends, all your gold is spent on leveling up (what is left at max level stays).',
  innate: { noInterest: true, stageGold: LANCE.stageGold, burnGold: true },
  card: {
    name: "Knight's Pay",
    icon: '💰',
    selfDesc: `From level ${LANCE.card.level} on, every round end pays +${LANCE.card.gold} gold.`,
    self: { levelGold: LANCE.card },
    // The same for anyone else (not the innate).
    otherDesc: `From level ${LANCE.card.level} on, every round end pays +${LANCE.card.gold} gold.`,
    other: { levelGold: LANCE.card },
  },
};
