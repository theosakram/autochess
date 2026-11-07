import { pct } from '../traits/format';
import type { CommanderDef, EchoPower, EssencePower } from './types';

// Tune with `bun run balance`. The role effects themselves are in essence.ts (ESSENCE_ROLES).
export const LUO_YI = {
  essence: { share: 0.4 } satisfies EssencePower,
  echo: { tier: 3, total: 6 } satisfies EchoPower,
};

const echoDesc =
  `Get a random ${LUO_YI.echo.tier}-cost hero now, then another copy of that same hero at the start of every round, ` +
  `until you've had ${LUO_YI.echo.total} in all.`;

export const luoyi: CommanderDef = {
  id: 'luoyi',
  name: 'Luo Yi',
  icon: '🧙‍♀️',
  title: 'Sage of the Deep Earth',
  desc:
    'Raises an Essence Altar beside your board. Put a hero on it and it becomes an Essence Core, an item another hero can hold: ' +
    `the holder gets ${pct(LUO_YI.essence.share)} of that hero's HP, attack, magic attack, armor and magic resist, ` +
    `${pct(LUO_YI.essence.share)} of the stats of the items it held, and an Enhancement Effect for each of its roles. ` +
    "The hero on the altar doesn't count toward traits. Take it back out any time, or put another hero on to swap them.",
  innate: { essence: LUO_YI.essence },
  card: {
    name: 'Earthen Echo',
    icon: '🏔️',
    selfDesc: echoDesc,
    self: { echo: LUO_YI.echo },
    otherDesc: echoDesc,
    other: { echo: LUO_YI.echo },
  },
};
