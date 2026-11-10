import { COMMANDER_CARD_ROUND, roundAt, roundLabel } from '../config';
import { list, term } from './terms';
import type { CommanderDef, TierShopPower } from './types';

// Tune with `bun run commanders`. Charges and the shop itself: tierShop.ts.
export const HARLEY = {
  shop: { first: roundAt(2, 1), every: 6, tier: 5, free: 1 } satisfies TierShopPower, // a charge on II-1, III-1, ...
  // The card: a charge the round after the commander card round (I-3), then every 4 rounds; the same on anyone.
  card: { first: COMMANDER_CARD_ROUND + 1, every: 4, tier: 4, free: 1 } satisfies TierShopPower,
  cardGold: 6,
};

const s = HARLEY.shop;
const c = HARLEY.card;
const FULL_HOUSE = (tier: number) => term('fullHouse', `${tier}-gold Full House`);
const cardDesc = `Gain ${HARLEY.cardGold} gold now. Gain a ${FULL_HOUSE(c.tier)} charge on ${roundLabel(c.first)} and every ${c.every} rounds after.`;

export const harley: CommanderDef = {
  id: 'harley',
  name: 'Harley',
  icon: '🃏',
  title: 'The Wildcard',
  desc: `Gain a ${FULL_HOUSE(s.tier)} charge on ${roundLabel(s.first)} and every ${s.every} rounds after.`,
  innate: { tierShop: HARLEY.shop },
  card: {
    name: 'Stacked Deck',
    icon: '🎴',
    selfDesc: cardDesc,
    self: { tierShopCard: HARLEY.card, pickGold: HARLEY.cardGold },
    otherDesc: cardDesc,
    other: { tierShopCard: HARLEY.card, pickGold: HARLEY.cardGold },
  },
  terms: {
    fullHouse: {
      icon: '🃏',
      title: 'Full House',
      body: list(
        'Charges stack. Use one any time between fights with its button by the shop.',
        'Your shop is replaced by heroes of that cost, every slot. If the pool runs out of them, the rest roll as usual.',
        'Your next hero bought this round is free. A free buy not used by the end of the round is lost.',
      ),
    },
  },
};
