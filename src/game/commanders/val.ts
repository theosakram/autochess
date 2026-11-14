import { list, term } from './terms';
import type { CommanderDef, ScoutPower } from './types';

// Tune with `bun run commanders`. Charges and the shop itself: scout.ts.
export const VAL = {
  // A Scouted shop's own odds, per cost 1-5: the point is a shot at the 4- and 5-gold heroes of a trait.
  scout: { levels: [5, 6, 7, 8, 9, 10], free: 1, odds: [0, 0, 20, 45, 35] } satisfies ScoutPower,
  card: { free: 1, gold: 1 },
};

const SCOUT = term('scout', 'Scout');
const cardDesc = `Every time you level up: your next hero bought this round is free, and +${VAL.card.gold} gold.`;

export const val: CommanderDef = {
  id: 'val',
  name: 'Val',
  icon: '🔭',
  title: 'The Talent Scout',
  desc: `Gain a ${SCOUT} charge on reaching level ${VAL.scout.levels.join(', ')}.`,
  innate: { scout: VAL.scout },
  card: {
    name: 'Recruiting Bonus',
    icon: '🎖️',
    selfDesc: cardDesc,
    self: { levelReward: VAL.card },
    // The same for anyone else (not the Scout).
    otherDesc: cardDesc,
    other: { levelReward: VAL.card },
  },
  terms: {
    scout: {
      icon: '🔭',
      title: 'Scout',
      body: list(
        'Charges stack. Open one of your heroes between fights and use its Scout button.',
        `Your shop is replaced: every hero in it shares at least one trait with the hero you picked, at Scout odds ` +
          `(${VAL.scout.odds.map((o, i) => (o ? `${i + 1}-gold ${o}%` : '')).filter(Boolean).join(', ')}), whatever your level.`,
        'Your next hero bought this round is free. A free buy not used by the end of the round is lost.',
      ),
    },
  },
};
