import { pct } from '../traits/format';
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
    `Opens Johnnie's Den: ${JOHNSON.johnnie.offer} Johnnies, each with a different random faction and role. Pick one and it's yours, free. ` +
    'From then on that Johnnie (the same faction and role) turns up in your shop like any 3-gold hero, and costs nothing ' +
    "(it sells for nothing too). Johnnie has a 3-gold hero's stats; when a fight starts it leaps where the enemies are thickest.",
  innate: { johnnie: JOHNSON.johnnie },
  card: {
    name: 'Family Business',
    icon: '💼',
    selfDesc:
      `Every Johnnie gets +${pct(JOHNSON.card.hybridAtk)} attack and magic attack and +${pct(JOHNSON.card.hp)} max HP, ` +
      `and your Johnnie turns up in the shop more often (as if it had ${JOHNSON.cardPool} more copies).`,
    self: { johnnieBuff: JOHNSON.card, johnniePool: JOHNSON.cardPool },
  },
};
