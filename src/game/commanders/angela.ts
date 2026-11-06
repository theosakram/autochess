import { pct } from '../traits/format';
import type { CommanderDef, ProtectPower } from './types';

// Tune with `bun run balance`.
export const ANGELA = {
  innate: { picks: 1, skillAmp: 0.35, refund: 0.2 } satisfies ProtectPower,
  card: { picks: 2, skillAmp: 0.35, refund: 0.2 } satisfies ProtectPower,
};

const blessing = `+${pct(ANGELA.innate.skillAmp)} skill damage, and ${pct(ANGELA.innate.refund)} of its max mana back every time it casts its skill`;

export const angela: CommanderDef = {
  id: 'angela',
  name: 'Angela',
  icon: '😇',
  title: 'Guardian Angel',
  desc:
    'Protects two heroes: one you pick (open a unit to give it your halo), and your fielded hero with the most items ' +
    `(chosen for you; ties go to the higher star, then cost). Each gets ${blessing}.`,
  innate: { protect: ANGELA.innate },
  card: {
    name: 'Choir of Wings',
    icon: '🕊️',
    selfDesc: `Protect one more hero of your choice: ${ANGELA.card.picks} picked plus the one with the most items, 3 in all.`,
    self: { protect: ANGELA.card },
  },
};
