import { COMMANDER_CARD_ROUND } from '../config';
import { list, term } from './terms';
import type { CommanderDef, TreasurePower } from './types';

// Tune with `bun run commanders`. The treasure's prizes are paid in treasure.ts.
export const ZHU_YONG = {
  tierUp: 1,
  treasure: { round: COMMANDER_CARD_ROUND, chestGold: 5, heroes: 4, gold: 13 } satisfies TreasurePower,
  cardTierUp: 1, // on Zhu Yong, on top of his own (so his power cards are always gold); on anyone else, alone
};

const t = ZHU_YONG.treasure;
const TREASURE = term('dragonTreasure', 'Black Dragon Treasure');

export const zhuyong: CommanderDef = {
  id: 'zhuyong',
  name: 'Zhu Yong',
  icon: '🐉',
  title: 'Warden of the Black Dragon Hoard',
  desc:
    `Both power card rounds offer cards one tier higher (blue to purple, purple to gold); already gold, you get a ${TREASURE} instead. ` +
    `Also a ${TREASURE} on the commander card round.`,
  innate: { tierUp: ZHU_YONG.tierUp, treasure: ZHU_YONG.treasure },
  card: {
    name: 'Dragon Ascendant',
    icon: '🐲',
    selfDesc: `Power card rounds go up one more tier: your power cards are always gold, and every tier past gold is a ${TREASURE}.`,
    self: { tierUpCard: ZHU_YONG.cardTierUp },
    otherDesc: 'Both power card rounds offer cards one tier higher: blue to purple, purple to gold.',
    other: { tierUpCard: ZHU_YONG.cardTierUp },
  },
  terms: {
    dragonTreasure: {
      icon: '🐉',
      title: 'Black Dragon Treasure',
      body:
        '<p>Opens at once, paying one of these at random:</p>' +
        list(
          'A random faction or role orb.',
          `An Equipment Chest and ${t.chestGold} gold.`,
          `${t.heroes} random heroes of your biggest trait (the one with the most fielded heroes), at costs your shop can roll now. With none fielded: ${t.gold} gold.`,
          `${t.gold} gold.`,
        ),
    },
  },
};
