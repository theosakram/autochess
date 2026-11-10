import { pct } from '../traits/format';
import { list, term } from './terms';
import type { CommanderDef, JohnniePower } from './types';

// Tune with `bun run balance`. Johnnie's own stats and skill: units.ts (JOHNNIES) and skills/partyCrasher.ts.
export const JOHNSON = {
  johnnie: { offer: 5 } satisfies JohnniePower,
  card: { hybridAtk: 0.35, hp: 0.3 },
  cardPool: 5, // the card: Johnnie rolls in the shop as if its pool had this many more copies
};

export const johnson: CommanderDef = {
  id: 'johnson',
  name: 'Johnson',
  icon: '🎩',
  title: 'Head of the Johnnie Family',
  desc:
    `Opens Johnnie's Den: pick one of ${JOHNSON.johnnie.offer} ${term('johnnie', 'Johnnies')}, each with a random faction and role. ` +
    "It's yours free, and from then on it turns up in your shop costing nothing.",
  innate: { johnnie: JOHNSON.johnnie },
  card: {
    name: 'Family Business',
    icon: '💼',
    selfDesc:
      `Every Johnnie gets +${pct(JOHNSON.card.hybridAtk)} attack and magic attack and +${pct(JOHNSON.card.hp)} max HP, ` +
      `and your Johnnie turns up in the shop more often (as if it had ${JOHNSON.cardPool} more copies).`,
    self: { johnnieBuff: JOHNSON.card, johnniePool: JOHNSON.cardPool },
  },
  terms: {
    johnnie: {
      icon: '🎩',
      title: 'Johnnie',
      body: list(
        "Has a 3-gold hero's stats.",
        'When a fight starts, it leaps where the enemies are thickest.',
        'Your Johnnie keeps the faction and role you picked. It turns up in your shop like any 3-gold hero, costs nothing, and sells for nothing.',
      ),
    },
  },
};
