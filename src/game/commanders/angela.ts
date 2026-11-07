import { pct } from '../traits/format';
import type { CommanderDef, LoveBeamPower, ProtectPower } from './types';

// Tune with `bun run balance`.
export const ANGELA = {
  innate: { picks: 1, skillAmp: 0.6, refund: 0.3 } satisfies ProtectPower,
  // The card: every protected hero fires a Love Beam every `every` seconds.
  loveBeam: { every: 2, heal: 0.08, damage: [200, 350, 500, 800] } satisfies LoveBeamPower,
};

const b = ANGELA.loveBeam;

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
    selfDesc:
      `Every hero you protect fires a Love Beam every ${b.every}s: a straight line through its target to the edge of the board. ` +
      `Allies in its path are healed ${pct(b.heal)} of their max HP; enemies in it take ${b.damage.join('/')} magic damage ` +
      `(stage I/II/III/IV and later).`,
    self: { loveBeam: ANGELA.loveBeam },
  },
};
