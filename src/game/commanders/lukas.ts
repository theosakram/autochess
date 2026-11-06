import { pct } from '../traits/format';
import type { BeastPower, CommanderDef } from './types';

// Tune with `bun run balance`.
export const LUKAS = {
  innate: { damage: 0.3, stun: 2, frontRow: false, shred: 0.8, shredSeconds: 10 } satisfies BeastPower,
  card: { damage: 0.5, stun: 2, frontRow: true, shred: 0.8, shredSeconds: 10 } satisfies BeastPower,
};

const back = (b: BeastPower) =>
  `From the back two rows, when a fight starts it beams the 3x3 with the most enemies: ${pct(b.damage)} of their max HP as magic damage, and a ${b.stun}s stun.`;

export const lukas: CommanderDef = {
  id: 'lukas',
  name: 'Lukas',
  icon: '🦁',
  title: 'Keeper of the Divine Beast',
  desc: `Summons a Divine Beast onto your board (it takes no slot). ${back(LUKAS.innate)} Then it vanishes until the next fight.`,
  innate: { beast: LUKAS.innate },
  card: {
    name: 'Vanguard Beast',
    icon: '🌟',
    selfDesc:
      `Your Divine Beast hits for ${pct(LUKAS.card.damage)} of max HP, and may stand on the front row: ` +
      `from there it hits the 3 tiles right ahead of it instead, without the stun, but tears their armor and magic resist by ${pct(LUKAS.card.shred)} for ${LUKAS.card.shredSeconds}s.`,
    self: { beast: LUKAS.card },
  },
};
