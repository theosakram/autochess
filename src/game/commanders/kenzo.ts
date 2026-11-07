import { blackSash } from '../items/blackSash';
import type { CommanderDef } from './types';

// Tune with `bun run balance`.
export const KENZO = {
  gold: { win: 1, loss: 2 },
};

export const kenzo: CommanderDef = {
  id: 'kenzo',
  name: 'Kenzo',
  icon: '🥊',
  title: 'Master of the Black Sash',
  desc: `Win a fight: +${KENZO.gold.win} extra gold. Lose a fight: +${KENZO.gold.loss} extra gold.`,
  innate: { roundGold: KENZO.gold },
  card: {
    name: blackSash.name,
    icon: blackSash.icon,
    selfDesc: `Obtain the ${blackSash.name}: ${blackSash.desc}`,
    self: { pickItem: blackSash.id },
  },
};
